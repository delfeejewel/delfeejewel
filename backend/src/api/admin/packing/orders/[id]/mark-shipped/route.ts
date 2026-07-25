import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createShipmentWorkflow } from "@medusajs/medusa/core-flows"

import { actorHasPermission } from "../../../../../../lib/rbac"

/**
 * POST /admin/packing/orders/:id/mark-shipped
 * Manual fallback for when the Shiprocket "picked up" webhook is late or
 * missed. Stamps the real fulfillment.shipped_at (via the same workflow core's
 * "Create Shipment" admin action uses) — idempotent if already shipped.
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
    fields: ["id", "metadata", "fulfillments.id", "fulfillments.shipped_at"],
  })
  const order = (orders as any[])?.[0]
  if (!order) return res.status(404).json({ message: "Order not found" })

  const packing = (order.metadata as any)?.packing
  if (!packing?.ready_to_ship_at) {
    return res.status(400).json({ message: "Mark ready to ship before marking shipped" })
  }

  const fulfillment = ((order.fulfillments as any[]) || []).find(
    (f) => f.id === packing.fulfillment_id
  )
  if (!fulfillment) {
    return res.status(404).json({ message: "Fulfillment not found" })
  }
  if (fulfillment.shipped_at) {
    return res.json({ shipped_at: fulfillment.shipped_at })
  }

  try {
    const { result } = await createShipmentWorkflow(req.scope).run({
      input: { id: fulfillment.id } as any,
    })
    return res.json({ shipped_at: (result as any)?.shipped_at || new Date().toISOString() })
  } catch (e: any) {
    // Already shipped by a concurrent request (e.g. the webhook) — not an error.
    if (String(e?.message || "").includes("already been created")) {
      return res.json({ shipped_at: new Date().toISOString() })
    }
    return res.status(500).json({ message: e?.message || "Could not mark shipped" })
  }
}
