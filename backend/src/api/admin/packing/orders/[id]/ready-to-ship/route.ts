import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { actorHasPermission } from "../../../../../../lib/rbac"

/**
 * POST /admin/packing/orders/:id/ready-to-ship
 * Only allowed once the fulfillment has both an AWB and a printed label —
 * this is what makes the checklist sequence strict.
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
      "fulfillments.id",
      "fulfillments.data",
      "fulfillments.labels.label_url",
    ],
  })
  const order = (orders as any[])?.[0]
  if (!order) return res.status(404).json({ message: "Order not found" })

  const prevMeta = (order.metadata as any) || {}
  const packing = prevMeta.packing
  if (!packing?.fulfillment_id) {
    return res.status(400).json({ message: "Start packing before marking ready to ship" })
  }

  const fulfillment = ((order.fulfillments as any[]) || []).find(
    (f) => f.id === packing.fulfillment_id
  )
  const awbCode = fulfillment?.data?.awb_code
  const labelUrl = (fulfillment?.labels || [])[0]?.label_url
  if (!awbCode) {
    return res.status(400).json({ message: "Generate the AWB before marking ready to ship" })
  }
  if (!labelUrl) {
    return res.status(400).json({ message: "Print the label before marking ready to ship" })
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
  const history = Array.isArray(packing.history) ? packing.history : []
  history.push({ step: "ready_to_ship", at: nowIso, actor_id: actorId, actor_email: actorEmail })

  const orderModule: any = req.scope.resolve(Modules.ORDER)
  await orderModule.updateOrders([
    {
      id: orderId,
      metadata: {
        ...prevMeta,
        packing: { ...packing, ready_to_ship_at: nowIso, history },
      },
    },
  ])

  return res.json({ ready_to_ship_at: nowIso })
}
