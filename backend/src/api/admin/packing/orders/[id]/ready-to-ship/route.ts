import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateFulfillmentWorkflow } from "@medusajs/medusa/core-flows"

import { actorHasPermission } from "../../../../../../lib/rbac"
import { resolveShiprocketProvider } from "../../../../../../lib/shiprocket-provider"
import { assertStepAllowed } from "../../../../../../lib/packing-steps"

/**
 * POST /admin/packing/orders/:id/ready-to-ship
 * Only allowed once the fulfillment has both an AWB and a printed label —
 * this is what makes the checklist sequence strict. This is also the step
 * that actually notifies Shiprocket to send a courier: AWB assignment and
 * label generation don't request a pickup on their own.
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
      "items.*",
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
  const fData = (fulfillment?.data || {}) as any
  const awbCode = fData.awb_code
  const labelUrl = (fulfillment?.labels || [])[0]?.label_url
  if (!awbCode) {
    return res.status(400).json({ message: "Generate the AWB before marking ready to ship" })
  }
  if (!labelUrl) {
    return res.status(400).json({ message: "Print the label before marking ready to ship" })
  }

  // Full hierarchy check: items picked, gift wrap applied, label PASTED,
  // invoice printed and in the box, parcel sealed.
  //
  // This route previously checked only the AWB and the label, so an order could
  // be marked ready — and a van called — with not a single item ticked.
  const orderItems = (order.items as any[]) || []
  const blockedBy = assertStepAllowed("ready_to_ship", {
    // Service lines (gift wrap, COD fee) are never physically picked.
    itemIds: orderItems
      .filter((i) => !["gift-wrap", "cod-fee"].includes(i.product_handle))
      .map((i) => i.id),
    giftWrap: orderItems.some((i) => i.product_handle === "gift-wrap"),
    packing,
    fulfillmentData: fData,
    labelUrl,
  })
  if (blockedBy) {
    return res.status(400).json({ message: blockedBy })
  }

  // Best-effort: this is the call that tells Shiprocket to actually send a
  // courier. A failure here must not block marking the order ready-to-ship —
  // the admin can retry via the "request_pickup" shiprocket action, and the
  // outcome is recorded either way so it's visible instead of silently lost.
  let pickupRequested = false
  let pickupScheduledDate: string | null = null
  if (fData.shiprocket_shipment_id) {
    try {
      const provider: any = resolveShiprocketProvider(req.scope)
      const pickup = await provider.requestPickup(fData.shiprocket_shipment_id)
      pickupRequested = pickup.requested
      pickupScheduledDate = pickup.pickup_scheduled_date
      await updateFulfillmentWorkflow(req.scope).run({
        input: {
          id: packing.fulfillment_id,
          data: {
            ...fData,
            pickup_requested_at: pickupRequested ? new Date().toISOString() : null,
            pickup_scheduled_date: pickupScheduledDate,
          },
        } as any,
      })
    } catch {
      // Left unrequested — surfaced to the admin in the packing drawer.
    }
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
  history.push({
    step: "ready_to_ship",
    at: nowIso,
    actor_id: actorId,
    actor_email: actorEmail,
    pickup_requested: pickupRequested,
  })

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

  return res.json({
    ready_to_ship_at: nowIso,
    pickup_requested: pickupRequested,
    pickup_scheduled_date: pickupScheduledDate,
  })
}
