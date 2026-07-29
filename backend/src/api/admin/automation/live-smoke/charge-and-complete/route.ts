import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import Razorpay from "razorpay"

import { actorHasPermission } from "../../../../../lib/rbac"

/**
 * POST /admin/automation/live-smoke/charge-and-complete
 *
 * Used ONLY by the weekly live smoke test (e2e/live-weekly-smoke.ts). Given
 * a cart_id that already has a pending Razorpay payment session (created the
 * same way a real checkout creates one), charges the ONE pre-saved card
 * token reserved for this automation via Razorpay's recurring-payment API
 * (server-side, no card data ever touches this route or CI), then completes
 * the cart into an order the same way a normal successful checkout would —
 * completeCartWorkflow internally calls the Razorpay provider's
 * authorizePayment, which independently re-checks the charge against
 * Razorpay before authorizing (see modules/razorpay/service.ts).
 *
 * Triple-gated so this can never be used to charge anything else:
 *   1. Admin-authenticated + orders.write, same as every other order-mutating route.
 *   2. Hard OFF unless LIVE_SMOKE_TEST_ENABLED="true" is set (503 otherwise) —
 *      absent by default, so the capability is inert unless deliberately enabled.
 *   3. The cart must contain exactly one line item, and its product_id must
 *      match LIVE_SMOKE_TEST_PRODUCT_ID — refuses to charge any real product.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!(await actorHasPermission(req, "orders.write"))) {
    return res.status(403).json({ message: "Forbidden" })
  }

  if (process.env.LIVE_SMOKE_TEST_ENABLED !== "true") {
    return res.status(503).json({ message: "Live smoke test automation is disabled" })
  }

  const { cart_id: cartId } = (req.body || {}) as { cart_id?: string }
  if (!cartId) {
    return res.status(400).json({ message: "cart_id is required" })
  }

  const testProductId = process.env.LIVE_SMOKE_TEST_PRODUCT_ID
  const customerId = process.env.RAZORPAY_LIVE_SMOKE_CUSTOMER_ID
  const token = process.env.RAZORPAY_LIVE_SMOKE_TOKEN_ID
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!testProductId || !customerId || !token || !keyId || !keySecret) {
    return res.status(503).json({
      message:
        "Live smoke test automation is missing required configuration " +
        "(LIVE_SMOKE_TEST_PRODUCT_ID / RAZORPAY_LIVE_SMOKE_CUSTOMER_ID / " +
        "RAZORPAY_LIVE_SMOKE_TOKEN_ID / RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)",
    })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: carts } = await query.graph({
    entity: "cart",
    filters: { id: cartId },
    fields: [
      "id",
      "email",
      "completed_at",
      "shipping_address.phone",
      "items.product_id",
      "payment_collection.payment_sessions.id",
      "payment_collection.payment_sessions.provider_id",
      "payment_collection.payment_sessions.status",
      "payment_collection.payment_sessions.data",
    ],
  })
  const cart = (carts as any[])?.[0]
  if (!cart) return res.status(404).json({ message: "Cart not found" })
  if (cart.completed_at) {
    return res.status(400).json({ message: "Cart is already completed" })
  }

  const items = (cart.items as any[]) || []
  if (items.length !== 1 || items[0]?.product_id !== testProductId) {
    return res.status(400).json({
      message:
        "This cart doesn't contain exactly one line item of the designated " +
        "live smoke test product — refusing to charge it",
    })
  }

  const sessions = (cart.payment_collection?.payment_sessions as any[]) || []
  const session = sessions.find(
    (s) => s.provider_id?.startsWith("pp_razorpay") && s.status === "pending"
  )
  if (!session?.data?.razorpay_order_id || session.data.amount == null) {
    return res.status(400).json({
      message: "No pending Razorpay payment session with an order/amount found on this cart",
    })
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })

  try {
    await razorpay.payments.createRecurringPayment({
      email: cart.email,
      contact: cart.shipping_address?.phone || "9999999999",
      amount: session.data.amount,
      currency: "INR",
      order_id: session.data.razorpay_order_id,
      customer_id: customerId,
      token,
      recurring: "1",
      description: "Weekly automated live smoke test",
      notes: { automated_live_smoke_test: "true" },
    } as any)
  } catch (e: any) {
    return res.status(502).json({
      message: e?.error?.description || e?.message || "Razorpay recurring charge failed",
    })
  }

  try {
    const { result } = await completeCartWorkflow(req.scope).run({ input: { id: cartId } })
    return res.json({ order_id: (result as any)?.id, display_id: (result as any)?.display_id })
  } catch (e: any) {
    return res.status(500).json({
      message:
        "Payment was charged but the cart could not be completed into an order — " +
        `check Razorpay order ${session.data.razorpay_order_id} manually: ${e?.message}`,
    })
  }
}
