import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { actorHasPermission } from "../../../../../lib/rbac"

/**
 * POST /admin/fraud-review/:id/clear
 * Marks a flagged order as reviewed-and-safe: sets `fraud_status = cleared`
 * so it drops out of the review queue. Records who cleared it and when.
 *
 * Gated by `orders.write` (lib/rbac.ts).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  if (!(await actorHasPermission(req, "orders.write"))) {
    return res.status(403).json({ message: "Access denied. Orders permission required." })
  }
  const orderId = req.params.id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orderModule: any = req.scope.resolve(Modules.ORDER)

  const { data: [order] } = await query.graph({
    entity: "order",
    fields: ["id", "metadata"],
    filters: { id: orderId },
  })
  if (!order) {
    return res.status(404).json({ message: "Order not found." })
  }

  const meta = ((order as any).metadata as any) || {}
  const actorId = (req as any).auth_context?.actor_id || null

  await orderModule.updateOrders([
    {
      id: orderId,
      metadata: {
        ...meta,
        fraud_status: "cleared",
        fraud_cleared_at: new Date().toISOString(),
        fraud_cleared_by: actorId,
      },
    },
  ])

  return res.json({ status: "cleared", order_id: orderId })
}
