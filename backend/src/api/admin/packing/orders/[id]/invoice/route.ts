import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { actorHasPermission } from "../../../../../../lib/rbac"
import { resolveActor, appendPackingHistory } from "../../../../../../lib/packing-log"

/**
 * POST /admin/packing/orders/:id/invoice
 * Body: { action: "mark_printed" } | { action: "toggle_added", added: boolean }
 *
 * Tracks two independent, manually-confirmed packing steps around the paper
 * invoice: printing it (stamped the moment the packer clicks "Print
 * Invoice" in the drawer — mirrors how "Print label" stamps immediately on
 * generation, not on physical confirmation) and physically placing it in
 * the box (a plain toggle, since it's easy to un-check by mistake).
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!(await actorHasPermission(req, "shipping.write"))) {
    return res.status(403).json({ message: "Forbidden" })
  }

  const orderId = req.params.id
  const { action, added } = (req.body || {}) as {
    action?: string
    added?: boolean
  }
  if (action !== "mark_printed" && action !== "toggle_added") {
    return res.status(400).json({
      message: 'action must be "mark_printed" or "toggle_added"',
    })
  }
  if (action === "toggle_added" && typeof added !== "boolean") {
    return res.status(400).json({ message: "added (boolean) is required" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: ["id", "metadata"],
  })
  const order = (orders as any[])?.[0]
  if (!order) return res.status(404).json({ message: "Order not found" })

  const prevMeta = (order.metadata as any) || {}
  const packing = prevMeta.packing
  if (!packing?.fulfillment_id) {
    return res.status(400).json({ message: "Start packing before printing the invoice" })
  }

  const actor = await resolveActor(req.scope, (req as any).auth_context)
  const nowIso = new Date().toISOString()

  const nextPacking =
    action === "mark_printed"
      ? {
          ...packing,
          invoice_printed_at: packing.invoice_printed_at || nowIso,
          history: packing.invoice_printed_at
            ? packing.history
            : appendPackingHistory(packing, { step: "invoice_printed", ...actor }),
        }
      : {
          ...packing,
          invoice_added_at: added ? nowIso : null,
          history: appendPackingHistory(packing, {
            step: added ? "invoice_added" : "invoice_unadded",
            ...actor,
          }),
        }

  const orderModule: any = req.scope.resolve(Modules.ORDER)
  await orderModule.updateOrders([
    { id: orderId, metadata: { ...prevMeta, packing: nextPacking } },
  ])

  return res.json({
    invoice_printed_at: nextPacking.invoice_printed_at || null,
    invoice_added_at: nextPacking.invoice_added_at || null,
  })
}
