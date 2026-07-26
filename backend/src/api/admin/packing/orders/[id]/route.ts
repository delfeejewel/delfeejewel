import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { resolveShiprocketProvider } from "../../../../../lib/shiprocket-provider"

/**
 * GET /admin/packing/orders/:id
 * Full packing-checklist detail for one order: items, packing progress, and
 * (once a fulfillment exists) its live Shiprocket AWB/label state.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  // This screen reflects live operational state (packing/AWB/pickup) that
  // can change from actions taken outside this exact request (Shiprocket
  // dashboard, another tab's Cancel Fulfillment, etc.) — never let the
  // browser treat a byte-identical-looking response as still fresh.
  delete req.headers["if-none-match"]
  delete req.headers["if-modified-since"]
  res.set("Cache-Control", "no-store")

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

  const fulfillment = packing?.fulfillment_id
    ? ((order.fulfillments as any[]) || []).find(
        (f) => f.id === packing.fulfillment_id
      )
    : null

  // The referenced fulfillment was cancelled (e.g. undone because the item
  // wasn't actually ready for pickup) — present a clean slate for the
  // checklist rather than stale AWB/label/pickup state, while still keeping
  // the activity log so what happened on the earlier attempt isn't lost.
  const cancelled = !!fulfillment?.canceled_at
  const activePacking = cancelled ? null : packing

  const items = ((order.items as any[]) || []).map((it) => ({
    id: it.id,
    title: it.title,
    variant_title: it.variant_title || null,
    quantity: it.detail?.quantity ?? it.quantity ?? 1,
    packed: !!activePacking?.packed_item_ids?.includes(it.id),
  }))

  const fData = (!cancelled && fulfillment?.data) || {}
  const label = (!cancelled && fulfillment?.labels?.[0]) || {}
  const provider: any = resolveShiprocketProvider(req.scope)

  return res.json({
    simulate: !!provider?.isSimulating?.(),
    id: order.id,
    display_id: order.display_id,
    email: order.email,
    fulfillment_status: order.fulfillment_status,
    gift_wrap: !!(order.metadata as any)?.gift_wrap,
    gift_wrappers_used: (order.metadata as any)?.gift_wrappers_used ?? null,
    items,
    // Always surfaced, even after a cancelled attempt, so the record of what
    // happened isn't lost just because the checklist reset.
    history: Array.isArray(packing?.history) ? packing.history : [],
    packing: activePacking
      ? {
          fulfillment_id: activePacking.fulfillment_id,
          started_at: activePacking.started_at,
          ready_to_ship_at: activePacking.ready_to_ship_at,
        }
      : null,
    fulfillment:
      !cancelled && fulfillment
        ? {
            id: fulfillment.id,
            provider_id: fulfillment.provider_id,
            awb_code: fData.awb_code || null,
            courier_name: fData.courier_name || null,
            label_url: label.label_url || null,
            tracking_url: label.tracking_url || null,
            shipped_at: fulfillment.shipped_at || null,
            canceled_at: fulfillment.canceled_at || null,
            pickup_requested_at: fData.pickup_requested_at || null,
            pickup_scheduled_date: fData.pickup_scheduled_date || null,
          }
        : null,
  })
}
