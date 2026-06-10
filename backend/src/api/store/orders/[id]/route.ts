import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { getOrderDetailWorkflow } from "@medusajs/core-flows"

/**
 * Override of core GET /store/orders/:id.
 *
 * The core handler fetches an order purely by id with NO ownership check
 * (it even ships with a `// TODO: Do we want to apply some sort of
 * authentication here?` comment). That is an IDOR: any logged-in — or even
 * anonymous — caller could read any order by guessing/altering the id in the
 * URL (e.g. /account/orders/details/<someone-elses-id>).
 *
 * We scope the lookup to the authenticated customer. The global `/store`
 * auth middleware runs with `allowUnauthenticated: true`, so it populates
 * `req.auth_context.actor_id` for logged-in customers but lets anonymous
 * requests through — hence we must enforce ownership here in the handler.
 *
 * - No customer session            -> 401
 * - Order belongs to someone else  -> 404 (the workflow's `throwIfKeyNotFound`
 *                                     fires when no order matches id+customer_id,
 *                                     so we never leak that the id exists)
 *
 * Guest order tracking is unaffected: it uses the separate
 * /store/orders/lookup and /store/orders/track-by-token routes, not this one.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id

  if (!customerId) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const { result } = await getOrderDetailWorkflow(req.scope).run({
    input: {
      fields: req.queryConfig.fields,
      order_id: req.params.id,
      filters: {
        is_draft_order: false,
        customer_id: customerId,
      },
    },
  })

  return res.status(200).json({ order: result })
}
