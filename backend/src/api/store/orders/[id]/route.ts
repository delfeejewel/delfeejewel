import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { getOrderDetailWorkflow } from "@medusajs/core-flows"
import { verifyTrackToken } from "../../../../utils/track-token"

/**
 * Override of core GET /store/orders/:id.
 *
 * The core handler fetches an order purely by id with NO ownership check
 * (it even ships with a `// TODO: Do we want to apply some sort of
 * authentication here?` comment). That is an IDOR: any logged-in — or even
 * anonymous — caller could read any order by guessing/altering the id in the
 * URL (e.g. /account/orders/details/<someone-elses-id>).
 *
 * Authorization is one of two things. The global `/store` auth middleware runs
 * with `allowUnauthenticated: true`, so it populates `req.auth_context.actor_id`
 * for logged-in customers but lets anonymous requests through:
 *
 *   1. Logged-in customer -> the lookup is scoped to `customer_id`, so a
 *      customer can only read their own orders (foreign order -> 404 via the
 *      workflow's `throwIfKeyNotFound`, so the id is never leaked).
 *
 *   2. Guest with a valid order token -> the order-confirmation page redirect
 *      has no customer session, so guests authorize with a signed track token
 *      (the same HMAC token used by the "Track your order" email link), minted
 *      at checkout by POST /store/orders/confirmation-token. The token's
 *      `order_id` must match the URL id, so it grants access to that one order
 *      only — it can't be replayed against a different id.
 *
 * Anything else -> 401.
 *
 * Public guest order tracking (number + email) is unaffected: it uses the
 * separate /store/orders/lookup and /store/orders/track-by-token routes.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id

  const filters: Record<string, any> = { is_draft_order: false }

  if (customerId) {
    // Scope to the authenticated customer's own orders.
    filters.customer_id = customerId
  } else {
    // No session: require a signed token that authorizes exactly this order.
    const token =
      (req.headers["x-order-token"] as string) ||
      (req.query.token as string | undefined)
    const payload = verifyTrackToken(token)

    if (!payload || payload.order_id !== req.params.id) {
      return res.status(401).json({ message: "Unauthorized" })
    }
    // Token is order-scoped; no extra filter needed beyond the id below.
  }

  const { result } = await getOrderDetailWorkflow(req.scope).run({
    input: {
      fields: req.queryConfig.fields,
      order_id: req.params.id,
      filters,
    },
  })

  return res.status(200).json({ order: result })
}
