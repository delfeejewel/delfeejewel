import { createHmac } from "crypto"

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import Razorpay from "razorpay"

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

  // 1. Verify signature
  const expected = createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex")
  if (expected !== razorpay_signature) {
    return res.status(400).json({ message: "Invalid payment signature" })
  }

  try {
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })

    // 2. Capture if needed
    const payment: any = await razorpay.payments.fetch(razorpay_payment_id)
    if (payment.status === "authorized") {
      await razorpay.payments.capture(
        razorpay_payment_id,
        payment.amount,
        payment.currency
      )
    }

    // 3. Stamp the cart with the upfront fact
    const cartModule: any = req.scope.resolve(Modules.CART)
    const cart = await cartModule.retrieveCart(cart_id)
    const newMetadata = {
      ...((cart?.metadata as any) || {}),
      cod_upfront_amount: Math.round(payment.amount / 100), // back to rupees
      cod_upfront_payment_id: razorpay_payment_id,
      cod_upfront_paid_at: new Date().toISOString(),
    }
    await cartModule.updateCarts(cart_id, { metadata: newMetadata })

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
