import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { actorHasPermission } from "../../../../../lib/rbac"
import { resolveShiprocketProvider } from "../../../../../lib/shiprocket-provider"
import { applyShipmentStatus } from "../../../../../lib/shipment-status"

/**
 * GET  /admin/orders/:id/shipment-status  → what we currently know
 * POST /admin/orders/:id/shipment-status  → pull fresh from Shiprocket
 *
 * The webhook is the primary source of status, but webhook delivery is not
 * guaranteed — a missed one leaves an order stuck on "Out for delivery"
 * indefinitely. This is the pull path: the dispatch panel's Refresh button, and
 * the same call the nightly reconciliation job makes.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!(await actorHasPermission(req, "shipping.write"))) {
    return res.status(403).json({ message: "Forbidden" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: req.params.id } as any,
    fields: ["id", "metadata", "fulfillments.data", "fulfillments.canceled_at"],
  })
  const order = (orders as any[])?.[0]
  if (!order) return res.status(404).json({ message: "Order not found" })

  const meta = (order.metadata as any) || {}
  return res.json(readState(order, meta))
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!(await actorHasPermission(req, "shipping.write"))) {
    return res.status(403).json({ message: "Forbidden" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: req.params.id } as any,
    fields: ["id", "metadata", "fulfillments.data", "fulfillments.canceled_at"],
  })
  const order = (orders as any[])?.[0]
  if (!order) return res.status(404).json({ message: "Order not found" })

  const meta = (order.metadata as any) || {}
  const awb = awbFor(order, meta)

  if (!awb) {
    return res.status(400).json({
      message:
        "No AWB on this order yet — assign a courier before checking status.",
    })
  }

  try {
    const provider: any = resolveShiprocketProvider(req.scope)
    const tracked = await provider.trackByAwb(awb)

    await applyShipmentStatus(req.scope, order.id, {
      status: tracked.status,
      courier_name: tracked.courier_name,
      awb,
      activities: tracked.history,
    })

    const { data: fresh } = await query.graph({
      entity: "order",
      filters: { id: req.params.id } as any,
      fields: ["id", "metadata", "fulfillments.data", "fulfillments.canceled_at"],
    })
    const updated = (fresh as any[])?.[0]
    return res.json(readState(updated, (updated.metadata as any) || {}))
  } catch (e: any) {
    // Give the actual carrier error, not "could not refresh" — a packer needs
    // to know whether the AWB is unknown to Shiprocket or the API is down.
    return res.status(502).json({
      message: e?.message || "Shiprocket did not return a status for this AWB.",
    })
  }
}

/* -------------------------------------------------------------------------- */

function awbFor(order: any, meta: any): string | null {
  const fromFulfillment = ((order.fulfillments as any[]) || [])
    .filter((f) => !f.canceled_at)
    .map((f) => f?.data?.awb_code)
    .find(Boolean)
  return fromFulfillment || meta.awb || null
}

function readState(order: any, meta: any) {
  return {
    awb: awbFor(order, meta),
    status: meta.shiprocket_status ?? null,
    status_at: meta.shiprocket_status_at ?? null,
    courier: meta.shiprocket_courier ?? null,
    delivered_at: meta.delivered_at ?? null,
    history: Array.isArray(meta.shiprocket_history) ? meta.shiprocket_history : [],
    activities: Array.isArray(meta.shiprocket_activities)
      ? meta.shiprocket_activities
      : [],
  }
}
