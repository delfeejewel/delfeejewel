import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { signTrackToken } from "../../../../utils/track-token"

/**
 * POST /store/orders/confirmation-token
 *
 * Mints a short signed order token so a *guest* (no customer session) can open
 * their own order-confirmation page right after checkout. The IDOR-hardened
 * GET /store/orders/:id rejects sessionless reads, so the storefront calls this
 * immediately after completing the cart and passes the returned token back as
 * the `x-order-token` header.
 *
 * Authorization is possession of the cart id that produced the order. Cart ids
 * are unguessable UUIDs held only in the buyer's cookie — the same secret that
 * already authorizes every mutation on the cart itself — so requiring the
 * cart_id to match the order's originating cart proves the caller is the buyer.
 * We never mint a token from an `order_id` alone (that would re-introduce the
 * IDOR this guards against).
 *
 * Body: { order_id: string, cart_id: string }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { order_id, cart_id } = (req.body || {}) as {
    order_id?: string
    cart_id?: string
  }

  if (!order_id || !cart_id) {
    return res
      .status(400)
      .json({ message: "order_id and cart_id are required." })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: ["id", "email", "cart.id"],
    filters: { id: order_id },
  })

  // The cart id must match the order's originating cart — proof of ownership.
  if (!order || !order.email || (order as any).cart?.id !== cart_id) {
    return res.status(403).json({ message: "Forbidden" })
  }

  const token = signTrackToken({ order_id: order.id, email: order.email })

  return res.json({ token })
}
