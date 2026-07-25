import { createHmac, timingSafeEqual } from "crypto"

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import Razorpay from "razorpay"

import { codTokenAmount, getCodPolicy } from "../../../../utils/cod"

/**
 * POST /store/cod-upfront/verify
 * Body: { cart_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * After the Razorpay popup succeeds the storefront calls this to:
 *  1. Verify the HMAC signature server-side.
 *  2. Capture the payment if it isn't already (auto-capture may be off).
 *  3. Stamp the cart's metadata with the upfront amount + Razorpay payment id
 *     so the values flow into the order on cart completion.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const {
    cart_id,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = (req.body || {}) as Record<string, string | undefined>

  if (
    !cart_id ||
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature
  ) {
    return res.status(400).json({ message: "Missing required fields" })
  }

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    return res
      .status(500)
      .json({ message: "Razorpay is not configured on the server" })
  }

  // 1. Verify signature (timing-safe)
  const expected = createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex")
  const expBuf = Buffer.from(expected)
  const sigBuf = Buffer.from(razorpay_signature)
  if (expBuf.length !== sigBuf.length || !timingSafeEqual(expBuf, sigBuf)) {
    return res.status(400).json({ message: "Invalid payment signature" })
  }

  try {
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })

    // 2. Bind the Razorpay order to THIS cart and to the token amount computed
    // from THIS cart's current total. Without this a customer could pay a ₹1
    // token on a throwaway cart and replay that triple to stamp an expensive
    // COD cart as "token paid".
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: carts } = await query.graph({
      entity: "cart",
      filters: { id: cart_id },
      fields: [
        "id",
        "total",
        "currency_code",
        "payment_collection.id",
        "payment_collection.payments.data",
        "payment_collection.payment_sessions.id",
        "payment_collection.payment_sessions.amount",
        "payment_collection.payment_sessions.provider_id",
        "payment_collection.payment_sessions.status",
        "payment_collection.payment_sessions.data",
        "payment_collection.payment_sessions.currency_code",
      ],
    })
    const cartRow = carts?.[0] as any
    if (!cartRow) {
      return res.status(404).json({ message: "Cart not found" })
    }
    const expectedToken = codTokenAmount(Number(cartRow.total || 0), getCodPolicy())

    const rzpOrder: any = await razorpay.orders.fetch(razorpay_order_id)
    if (
      rzpOrder?.notes?.cart_id !== cart_id ||
      rzpOrder?.notes?.type !== "cod_upfront"
    ) {
      return res
        .status(400)
        .json({ message: "This payment does not belong to your cart." })
    }

    // 3. Capture if needed
    const payment: any = await razorpay.payments.fetch(razorpay_payment_id)
    if (payment.order_id !== razorpay_order_id) {
      return res
        .status(400)
        .json({ message: "Payment does not match the order." })
    }
    const paidRupees = Math.round(payment.amount / 100)
    if (paidRupees < expectedToken) {
      return res.status(400).json({
        message: `The upfront amount paid (₹${paidRupees}) is less than the required token (₹${expectedToken}).`,
      })
    }
    if (payment.status === "authorized") {
      await razorpay.payments.capture(
        razorpay_payment_id,
        payment.amount,
        payment.currency
      )
    }

    // 4. Stamp the cart with the upfront fact
    const cartModule: any = req.scope.resolve(Modules.CART)
    const cart = await cartModule.retrieveCart(cart_id)
    const newMetadata = {
      ...((cart?.metadata as any) || {}),
      cod_upfront_amount: Math.round(payment.amount / 100), // back to rupees
      cod_upfront_payment_id: razorpay_payment_id,
      cod_upfront_paid_at: new Date().toISOString(),
    }
    await cartModule.updateCarts(cart_id, { metadata: newMetadata })

    // 5. Record the token as a real Medusa Payment on the cart's payment
    // collection (alongside the pp_cod_cod session for the remaining
    // balance), so admin's Paid Total/Outstanding reflect what was actually
    // collected — best-effort bookkeeping. The token was already genuinely
    // verified + captured above (steps 1-3); a failure here must never undo
    // that or block the customer's already-successful payment.
    try {
      const paymentCollectionId = cartRow?.payment_collection?.id
      const existingPayments: any[] = cartRow?.payment_collection?.payments || []
      const alreadyRecorded = existingPayments.some(
        (p: any) => p?.data?.razorpay_payment_id === razorpay_payment_id
      )
      if (paymentCollectionId && !alreadyRecorded) {
        const paymentModule: any = req.scope.resolve(Modules.PAYMENT)
        const session = await paymentModule.createPaymentSession(paymentCollectionId, {
          provider_id: "pp_razorpay_razorpay",
          amount: paidRupees,
          currency_code: cartRow.currency_code,
          data: {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            amount: payment.amount, // paise — matches authorizePayment's expected-amount check
          },
        })
        const authorized = await paymentModule.authorizePaymentSession(session.id, {
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
        })
        await paymentModule.capturePayment({
          payment_id: (authorized as any).id,
          is_captured: true,
        })
      }
    } catch (e: any) {
      req.scope
        .resolve(ContainerRegistrationKeys.LOGGER)
        .error(`cod-upfront: failed to record Medusa payment for cart ${cart_id}: ${e?.message}`)
    }

    // 6. Reduce the pp_cod_cod session's amount by the token already paid,
    // so when it's captured later (on delivery) it captures only the
    // remaining balance instead of the full original total. This MUST run
    // before cart-complete authorizes that session (authorizing copies the
    // session's amount onto a real Payment row, which can't be changed
    // after the fact) — the cart is still open at this point, so it's safe.
    try {
      const codSession = (cartRow?.payment_collection?.payment_sessions || []).find(
        (s: any) => s.provider_id === "pp_cod_cod" && s.status !== "authorized"
      )
      if (codSession) {
        const remaining = Number(cartRow.total || 0) - paidRupees
        const paymentModule: any = req.scope.resolve(Modules.PAYMENT)
        await paymentModule.updatePaymentSession({
          id: codSession.id,
          currency_code: codSession.currency_code || cartRow.currency_code,
          amount: Math.max(0, remaining),
          data: codSession.data || {},
        })
      }
    } catch (e: any) {
      req.scope
        .resolve(ContainerRegistrationKeys.LOGGER)
        .error(`cod-upfront: failed to reduce COD session amount for cart ${cart_id}: ${e?.message}`)
    }

    return res.json({
      verified: true,
      amount: Math.round(payment.amount / 100),
      payment_id: razorpay_payment_id,
    })
  } catch (e: any) {
    return res
      .status(500)
      .json({ message: e?.message || "Could not verify payment" })
  }
}
