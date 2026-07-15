import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { fetchTrimmedOrder, normalizeEmail } from "../../../../utils/order-lookup"
import { rateLimit, clientIp } from "../../../../utils/rate-limit"

/**
 * POST /store/orders/lookup
 * Public order lookup for guest tracking. Returns a trimmed view (no payment,
 * limited shipping address) so a guest with a stolen order # can't harvest PII.
 *
 * Body: { display_id: number|string, email: string }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // Throttle enumeration: order numbers are sequential, so an unthrottled
  // lookup lets an attacker walk display_ids against a known email (or guess
  // emails for a known order). 10 attempts/min per IP.
  const rl = rateLimit(`order-lookup:${clientIp(req)}`, 10, 60_000)
  if (!rl.allowed) {
    res.setHeader("Retry-After", String(rl.retryAfterSec))
    return res
      .status(429)
      .json({ message: "Too many attempts. Please try again shortly." })
  }

  const { display_id, email } = (req.body || {}) as {
    display_id?: number | string
    email?: string
  }

  const displayIdNum = Number(display_id)
  if (!Number.isInteger(displayIdNum) || displayIdNum <= 0 || !email) {
    return res.status(400).json({
      message: "An order number and email address are required.",
    })
  }

  const order = await fetchTrimmedOrder(req.scope, { display_id: displayIdNum })

  if (!order || !order.email || normalizeEmail(order.email) !== normalizeEmail(email)) {
    // Don't leak existence — same response either way
    return res
      .status(404)
      .json({ message: "We couldn't find an order with those details." })
  }

  return res.json({ order })
}
