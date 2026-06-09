import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createHmac, timingSafeEqual } from "crypto"
import {
  reconcilePaidCart,
  resolveCartId,
} from "../../../lib/reconcile-paid-cart"

/**
 * POST /hooks/razorpay
 * Razorpay webhook receiver — the reconciliation safety net for the
 * "payment captured but the order was never created" case (browser died /
 * placeOrder never ran), for BOTH online payments and COD upfront tokens.
 *
 * Verifies the HMAC signature over the raw body (preserved via middlewares.ts),
 * then on `payment.captured` finds the cart and auto-completes it into an order
 * — or flags it for admin review if it can't (see reconcilePaidCart).
 *
 * Configure in the Razorpay dashboard (Settings → Webhooks):
 *   URL:    https://api.delfee.in/hooks/razorpay
 *   Secret: RAZORPAY_WEBHOOK_SECRET   Events: payment.captured
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET

  if (!secret || secret === "your_webhook_secret") {
    logger.error("Razorpay webhook: RAZORPAY_WEBHOOK_SECRET is not configured")
    return res.status(500).json({ message: "Webhook secret not configured" })
  }

  // 1. Verify the signature over the RAW bytes Razorpay signed.
  const signature = req.headers["x-razorpay-signature"] as string | undefined
  const raw: Buffer | undefined = (req as any).rawBody
  if (!signature || !raw) {
    return res.status(400).json({ message: "Missing signature or body" })
  }
  const expected = createHmac("sha256", secret).update(raw).digest("hex")
  const valid =
    expected.length === signature.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  if (!valid) {
    logger.warn("Razorpay webhook: invalid signature")
    return res.status(401).json({ message: "Invalid signature" })
  }

  // 2. Parse and act only on captured payments.
  let event: any
  try {
    event = JSON.parse(raw.toString("utf8"))
  } catch {
    event = req.body
  }
  const entity = event?.payload?.payment?.entity
  if (event?.event !== "payment.captured" || !entity) {
    return res.status(200).json({ received: true, ignored: true })
  }

  const notes = entity.notes || {}
  const cartId = await resolveCartId(req.scope, notes)
  if (!cartId) {
    logger.error(
      `Razorpay webhook: captured payment ${entity.id} could not be mapped to a cart (notes: ${JSON.stringify(notes)})`
    )
    return res.status(200).json({ received: true, mapped: false })
  }

  try {
    const result = await reconcilePaidCart(req.scope, cartId, {
      razorpay_payment_id: entity.id,
      razorpay_order_id: entity.order_id,
      amount: Math.round(Number(entity.amount || 0) / 100),
      is_cod_token: notes.type === "cod_upfront",
    })
    logger.info(
      `Razorpay webhook: payment ${entity.id} cart ${cartId} -> ${result.status}`
    )
    return res.status(200).json({ received: true, ...result })
  } catch (e: any) {
    // Always 200 so Razorpay doesn't hammer retries; we've logged the failure.
    logger.error(`Razorpay webhook reconcile error: ${e?.message}`)
    return res.status(200).json({ received: true, error: true })
  }
}
