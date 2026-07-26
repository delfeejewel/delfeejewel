import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows"

import { actorHasPermission } from "../../../../../../lib/rbac"

/**
 * POST /admin/packing/orders/:id/start
 * First checklist step: creates the real Medusa fulfillment for the order
 * (same workflow the stock "Create Shipment" admin action uses — this is
 * also the moment the Shiprocket provider creates the shipment and
 * best-effort auto-assigns an AWB/label), and starts the packing session.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!(await actorHasPermission(req, "shipping.write"))) {
    return res.status(403).json({ message: "Forbidden" })
  }

  const orderId = req.params.id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: [
      "id",
      "metadata",
      "items.id",
      "items.detail.quantity",
      "items.quantity",
      "fulfillments.id",
      "fulfillments.canceled_at",
    ],
  })
  const order = (orders as any[])?.[0]
  if (!order) return res.status(404).json({ message: "Order not found" })

  const prevMeta = (order.metadata as any) || {}
  const prevPacking = prevMeta.packing
  const prevFulfillment = prevPacking?.fulfillment_id
    ? ((order.fulfillments as any[]) || []).find((f) => f.id === prevPacking.fulfillment_id)
    : null
  // A previous attempt exists but its fulfillment was cancelled (e.g. undone
  // because the item wasn't actually ready) — allow starting fresh rather
  // than permanently blocking on stale state.
  const prevAttemptCancelled = !!prevFulfillment?.canceled_at
  if (prevPacking?.fulfillment_id && !prevAttemptCancelled) {
    return res.status(400).json({ message: "Packing already started for this order" })
  }

  const items = ((order.items as any[]) || []).map((it) => ({
    id: it.id,
    quantity: it.detail?.quantity ?? it.quantity ?? 1,
  }))
  if (!items.length) {
    return res.status(400).json({ message: "Order has no items to fulfill" })
  }

  let fulfillment: any
  try {
    const result = await createOrderFulfillmentWorkflow(req.scope).run({
      input: { order_id: orderId, items },
    })
    fulfillment = result.result
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Could not create fulfillment" })
  }

  const actorId = (req as any).auth_context?.actor_id || null
  let actorEmail: string | null = null
  if (actorId) {
    try {
      const userModule: any = req.scope.resolve(Modules.USER)
      const [u] = await userModule.listUsers({ id: actorId })
      actorEmail = u?.email || null
    } catch {}
  }

  const nowIso = new Date().toISOString()
  const priorHistory = Array.isArray(prevPacking?.history) ? prevPacking.history : []
  const history = [
    ...priorHistory,
    ...(prevAttemptCancelled
      ? [{ step: "restarted_after_cancel", at: nowIso, actor_id: actorId, actor_email: actorEmail }]
      : []),
    { step: "started", at: nowIso, actor_id: actorId, actor_email: actorEmail },
  ]

  const orderModule: any = req.scope.resolve(Modules.ORDER)
  await orderModule.updateOrders([
    {
      id: orderId,
      metadata: {
        ...prevMeta,
        packing: {
          fulfillment_id: fulfillment.id,
          packed_item_ids: [],
          started_at: nowIso,
          ready_to_ship_at: null,
          history,
        },
      },
    },
  ])

  return res.json({ fulfillment_id: fulfillment.id, started_at: nowIso })
}
