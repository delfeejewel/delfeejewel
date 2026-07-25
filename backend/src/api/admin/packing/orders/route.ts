import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/** Orders that still need packing/dispatch work — not yet shipped/delivered/canceled. */
const DONE_STATUSES = new Set([
  "shipped",
  "partially_delivered",
  "delivered",
  "canceled",
])

/**
 * GET /admin/packing/orders
 * The employee's queue: every order still awaiting packing/dispatch, oldest
 * first (FIFO — the order that's been waiting longest gets packed next).
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "fulfillment_status",
      "metadata",
      "created_at",
      "items.id",
    ],
    pagination: { take: 200, order: { created_at: "ASC" } } as any,
  })

  const queue = ((orders as any[]) || [])
    .filter((o) => !DONE_STATUSES.has(o.fulfillment_status))
    .map((o) => {
      const packing = (o.metadata as any)?.packing || null
      return {
        id: o.id,
        display_id: o.display_id,
        email: o.email,
        fulfillment_status: o.fulfillment_status,
        item_count: (o.items || []).length,
        created_at: o.created_at,
        started: !!packing?.fulfillment_id,
        ready_to_ship: !!packing?.ready_to_ship_at,
      }
    })

  return res.json({ orders: queue })
}
