import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  cancelFulfillmentWorkflow,
  cancelOrderWorkflow,
} from "@medusajs/medusa/core-flows"

import { actorHasPermission } from "../../../../../lib/rbac"

/**
 * POST /admin/orders/:id/cancel-order
 *
 * One-click order cancellation that works whether or not packing has
 * started — unlike core's own POST /admin/orders/:id/cancel, which requires
 * every fulfillment to already be individually cancelled first and just
 * throws a generic error otherwise. Cancels any active (unshipped)
 * fulfillment (which cascades into voiding the Shiprocket shipment — see
 * shiprocket/service.ts#cancelFulfillment), then cancels the order itself,
 * which core auto-refunds any captured payments for and cancels the rest.
 *
 * A shipped fulfillment can never be cancelled — enforced both here (for a
 * clear upfront error) and natively at two deeper layers in Medusa core.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!(await actorHasPermission(req, "orders.write"))) {
    return res.status(403).json({ message: "Forbidden" })
  }

  const orderId = req.params.id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: [
      "id",
      "canceled_at",
      "fulfillments.id",
      "fulfillments.shipped_at",
      "fulfillments.canceled_at",
    ],
  })
  const order = (orders as any[])?.[0]
  if (!order) return res.status(404).json({ message: "Order not found" })

  if (order.canceled_at) {
    return res.status(400).json({ message: "This order is already cancelled" })
  }

  const fulfillments = (order.fulfillments as any[]) || []
  const shipped = fulfillments.find((f) => f.shipped_at && !f.canceled_at)
  if (shipped) {
    return res.status(400).json({
      message: "This order has already shipped and can't be cancelled — process a return instead",
    })
  }

  const active = fulfillments.filter((f) => !f.canceled_at)

  try {
    for (const f of active) {
      await cancelFulfillmentWorkflow(req.scope).run({ input: { id: f.id } })
    }
    const actorId = (req as any).auth_context?.actor_id
    await cancelOrderWorkflow(req.scope).run({
      input: { order_id: orderId, canceled_by: actorId },
    })
  } catch (e: any) {
    return res.status(500).json({
      message: e?.message || "Could not cancel this order",
    })
  }

  // cancelOrderWorkflow auto-refunds captured payments, but a refund-provider
  // failure (e.g. a transient Razorpay API error) does NOT fail/rollback the
  // workflow — the order still ends up cancelled either way. Re-check
  // afterward so a silently-stuck refund is surfaced instead of reporting a
  // clean "cancelled" when the customer's money never actually moved.
  let refund_warning: string | null = null
  try {
    const { data: after } = await query.graph({
      entity: "order",
      filters: { id: orderId },
      fields: [
        "id",
        "payment_collections.captured_amount",
        "payment_collections.refunded_amount",
        "payment_collections.payments.provider_id",
        "payment_collections.payments.amount",
        "payment_collections.payments.captured_at",
      ],
    })
    const collections = (after?.[0]?.payment_collections as any[]) || []
    const short = collections.filter(
      (pc) => Number(pc.captured_amount || 0) > Number(pc.refunded_amount || 0)
    )
    if (short.length) {
      const providers = short
        .flatMap((pc) => (pc.payments || []).filter((p: any) => p.captured_at))
        .map((p: any) => p.provider_id)
        .join(", ")
      refund_warning = `Order cancelled, but a captured payment (${providers}) could not be automatically refunded — check the payment and refund it manually.`
    }
  } catch {
    // Best-effort check only — never fail the response over this.
  }

  return res.json({ cancelled: true, ...(refund_warning ? { refund_warning } : {}) })
}
