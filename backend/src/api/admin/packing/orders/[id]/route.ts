import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/packing/orders/:id
 * Full packing-checklist detail for one order: items, packing progress, and
 * (once a fulfillment exists) its live Shiprocket AWB/label state.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const orderId = req.params.id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: [
      "id",
      "display_id",
      "email",
      "fulfillment_status",
      "metadata",
      "items.id",
      "items.title",
      "items.variant_title",
      "items.quantity",
      "items.detail.quantity",
      "fulfillments.id",
      "fulfillments.provider_id",
      "fulfillments.data",
      "fulfillments.shipped_at",
      "fulfillments.canceled_at",
      "fulfillments.labels.tracking_number",
      "fulfillments.labels.tracking_url",
      "fulfillments.labels.label_url",
    ],
  })
  const order = (orders as any[])?.[0]
  if (!order) return res.status(404).json({ message: "Order not found" })

  const packing = (order.metadata as any)?.packing || null

  const items = ((order.items as any[]) || []).map((it) => ({
    id: it.id,
    title: it.title,
    variant_title: it.variant_title || null,
    quantity: it.detail?.quantity ?? it.quantity ?? 1,
    packed: !!packing?.packed_item_ids?.includes(it.id),
  }))

  const fulfillment = packing?.fulfillment_id
    ? ((order.fulfillments as any[]) || []).find(
        (f) => f.id === packing.fulfillment_id
      )
    : null

  const fData = (fulfillment?.data || {}) as any
  const label = (fulfillment?.labels || [])[0] || {}

  return res.json({
    id: order.id,
    display_id: order.display_id,
    email: order.email,
    fulfillment_status: order.fulfillment_status,
    gift_wrap: !!(order.metadata as any)?.gift_wrap,
    gift_wrappers_used: (order.metadata as any)?.gift_wrappers_used ?? null,
    items,
    packing: packing
      ? {
          fulfillment_id: packing.fulfillment_id,
          started_at: packing.started_at,
          ready_to_ship_at: packing.ready_to_ship_at,
        }
      : null,
    fulfillment: fulfillment
      ? {
          id: fulfillment.id,
          provider_id: fulfillment.provider_id,
          awb_code: fData.awb_code || null,
          courier_name: fData.courier_name || null,
          label_url: label.label_url || null,
          tracking_url: label.tracking_url || null,
          shipped_at: fulfillment.shipped_at || null,
          canceled_at: fulfillment.canceled_at || null,
        }
      : null,
  })
}
