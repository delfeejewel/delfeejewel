import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { fetchTrimmedOrder, normalizeEmail } from "../../../../utils/order-lookup"
import { verifyTrackToken } from "../../../../utils/track-token"

/**
 * POST /store/orders/track-by-token
 * Opens a single order from the signed token embedded in the order-confirmation
 * email's "Track your order" link — no email re-entry required. Returns the same
 * trimmed view as /store/orders/lookup.
 *
 * Body: { token: string }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { token } = (req.body || {}) as { token?: string }

  const payload = verifyTrackToken(token)
  if (!payload) {
    return res
      .status(401)
      .json({ message: "This tracking link is invalid or has expired." })
  }

  const order = await fetchTrimmedOrder(req.scope, { id: payload.order_id })

  // Defense in depth: the token's email must still match the order's email.
  if (
    !order ||
    !order.email ||
    normalizeEmail(order.email) !== normalizeEmail(payload.email)
  ) {
    return res
      .status(404)
      .json({ message: "We couldn't find an order for this link." })
  }

  return res.json({ order })
}
