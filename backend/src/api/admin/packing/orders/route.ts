import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { resolveShiprocketProvider } from "../../../../lib/shiprocket-provider"

/**
 * Orders whose DISPATCH is genuinely finished — not yet shipped/delivered.
 * Deliberately does NOT include the "canceled" fulfillment_status: that value
 * means a fulfillment ATTEMPT was cancelled (e.g. AWB/pickup undone because
 * packing wasn't ready), not that the order is done — it still needs
 * packing, so it must stay in the queue. A genuinely cancelled ORDER is
 * caught separately via order.status below.
 */
const DONE_STATUSES = new Set(["shipped", "partially_delivered", "delivered"])

/**
 * GET /admin/packing/orders
 * The employee's queue: every order still awaiting packing/dispatch, oldest
 * first (FIFO — the order that's been waiting longest gets packed next).
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  // Live operational queue — never let the browser treat a byte-identical
  // response as still fresh (e.g. right after a cancel/restart elsewhere).
  delete req.headers["if-none-match"]
  delete req.headers["if-modified-since"]
  res.set("Cache-Control", "no-store")

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "status",
      "fulfillment_status",
      "metadata",
      "created_at",
      "items.id",
      "fulfillments.id",
      "fulfillments.canceled_at",
    ],
    pagination: { take: 200, order: { created_at: "ASC" } } as any,
  })

  const queue = ((orders as any[]) || [])
    .filter((o) => o.status !== "canceled" && !DONE_STATUSES.has(o.fulfillment_status))
    .map((o) => {
      const packing = (o.metadata as any)?.packing || null
      const activeFulfillment = packing?.fulfillment_id
        ? ((o.fulfillments as any[]) || []).find((f) => f.id === packing.fulfillment_id)
        : null
      // If the packing session's fulfillment was cancelled (e.g. undone
      // because the item wasn't actually ready), treat this as not started
      // again rather than showing stale "Ready to ship" state.
      const cancelled = !!activeFulfillment?.canceled_at
      return {
        id: o.id,
        display_id: o.display_id,
        email: o.email,
        fulfillment_status: o.fulfillment_status,
        item_count: (o.items || []).length,
        created_at: o.created_at,
        started: !!packing?.fulfillment_id && !cancelled,
        ready_to_ship: !!packing?.ready_to_ship_at && !cancelled,
      }
    })

  const provider: any = resolveShiprocketProvider(req.scope)
  return res.json({ orders: queue, simulate: !!provider?.isSimulating?.() })
}
