import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/orders/:id/fulfillments/shiprocket
 *
 * Lists every Shiprocket-provided fulfillment on this order with its current
 * AWB / label status, for the admin "Shiprocket shipment" widget.
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

  const shipments = ((order.fulfillments as any[]) || [])
    .filter((f) => (f.provider_id || "").startsWith("shiprocket"))
    .map((f) => {
      const data = (f.data || {}) as any
      const label = (f.labels || [])[0] || {}
      return {
        fulfillment_id: f.id,
        shipment_id: data.shiprocket_shipment_id || null,
        awb_code: data.awb_code || null,
        courier_name: data.courier_name || null,
        label_url: label.label_url || null,
        tracking_url: label.tracking_url || null,
        shipped_at: f.shipped_at || null,
        canceled_at: f.canceled_at || null,
      }
    })

  return res.json({ shipments })
}
