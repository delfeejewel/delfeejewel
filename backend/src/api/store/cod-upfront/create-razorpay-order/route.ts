import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import Razorpay from "razorpay"
import { codTokenAmount, getCodPolicy } from "../../../../utils/cod"

/**
 * POST /store/cod-upfront/create-razorpay-order
 * Body: { cart_id }
 *
 * Returns the Razorpay order for the COD upfront token. Idempotent — repeated
 * calls (retries) must never charge twice:
 *   1. token already paid (recorded on the cart) → return already_paid
 *   2. a pending order exists and Razorpay shows it paid → record + already_paid
 *   3. a pending order exists, still unpaid, same amount → reuse it
 *   4. otherwise → create a fresh order and remember it on the cart
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { cart_id } = (req.body || {}) as { cart_id?: string }
  if (!cart_id) {
    return res.status(400).json({ message: "cart_id is required" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const cartModule: any = req.scope.resolve(Modules.CART)

  const { data: carts } = await query.graph({
    entity: "cart",
    filters: { id: cart_id },
    fields: ["id", "total", "currency_code", "metadata"],
  })
  const cart = (carts as any[])?.[0]
  if (!cart) return res.status(404).json({ message: "Cart not found" })

  const currency = cart.currency_code as string
  const total = Number(cart.total) || 0
  const upfrontAmount = codTokenAmount(total, getCodPolicy())

  if (upfrontAmount <= 0) {
    return res.json({ upfront_required: false, amount: 0, currency })
  }

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    return res
      .status(500)
      .json({ message: "Razorpay is not configured on the server" })
  }

  const meta = (cart.metadata as Record<string, any>) || {}

  // 1. Token already recorded as paid → never re-charge.
  if (meta.cod_upfront_payment_id) {
    return res.json({
      upfront_required: true,
      already_paid: true,
      amount: Number(meta.cod_upfront_amount) || upfrontAmount,
      currency,
      razorpay_key_id: keyId,
    })
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
  const stamp = (patch: Record<string, any>) =>
    cartModule.updateCarts(cart_id, { metadata: { ...meta, ...patch } })

  try {
    // 2/3. There's a pending order from a previous attempt — inspect it.
    const pendingId = meta.cod_pending_razorpay_order_id as string | undefined
    if (pendingId) {
      const { items } = await razorpay.orders.fetchPayments(pendingId)
      const paid: any = (items || []).find(
        (p: any) => p.status === "captured" || p.status === "authorized"
      )
      if (paid) {
        // Paid on a previous attempt but our verify never recorded it (e.g. the
        // verify request failed). Capture if needed and record it now.
        if (paid.status === "authorized") {
          try {
            await razorpay.payments.capture(paid.id, paid.amount, paid.currency)
          } catch {
            // already captured / capture race — safe to ignore
          }
        }
        const amount = Math.round(paid.amount / 100)
        await stamp({
          cod_upfront_amount: amount,
          cod_upfront_payment_id: paid.id,
          cod_upfront_paid_at: new Date().toISOString(),
        })
        return res.json({
          upfront_required: true,
          already_paid: true,
          amount,
          currency,
          razorpay_key_id: keyId,
        })
      }
      // Still unpaid and the amount hasn't changed → reuse the same order.
      if (Number(meta.cod_pending_amount) === upfrontAmount) {
        return res.json({
          upfront_required: true,
          amount: upfrontAmount,
          currency,
          razorpay_order_id: pendingId,
          razorpay_key_id: keyId,
        })
      }
    }

    // 4. Create a fresh order and remember it for idempotent retries.
    const order = await razorpay.orders.create({
      amount: upfrontAmount * 100, // paise
      currency: currency.toUpperCase(),
      receipt: `cod_upfront_${cart_id.slice(-16)}`,
      notes: { cart_id, type: "cod_upfront" },
    })
    await stamp({
      cod_pending_razorpay_order_id: order.id,
      cod_pending_amount: upfrontAmount,
    })

    return res.json({
      upfront_required: true,
      amount: upfrontAmount,
      currency,
      razorpay_order_id: order.id,
      razorpay_key_id: keyId,
    })
  } catch (e: any) {
    return res
      .status(500)
      .json({ message: e?.message || "Could not create Razorpay order" })
  }
}
