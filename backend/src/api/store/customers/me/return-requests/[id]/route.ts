import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { RETURN_REQUEST_MODULE } from "../../../../../../modules/return_request"

/**
 * GET /store/customers/me/return-requests/:id
 * Customer's view of one of their return requests (with items).
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Authentication required" })
  }

  const id = req.params.id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const returnModule: any = req.scope.resolve(RETURN_REQUEST_MODULE)

  const [rr] = await returnModule.listReturnRequests({
    id,
    customer_id: customerId,
  })
  if (!rr) {
    return res.status(404).json({ message: "Return request not found" })
  }

  const { data: items } = await query.graph({
    entity: "return_request_item",
    filters: { return_request_id: id } as any,
    fields: [
      "id",
      "line_item_id",
      "variant_id",
      "title",
      "thumbnail",
      "quantity",
      "unit_price",
      "reason",
    ],
  })

  return res.json({ return_request: { ...rr, items: items || [] } })
}
