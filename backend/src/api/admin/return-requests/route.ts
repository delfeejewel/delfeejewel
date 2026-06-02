import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { RETURN_REQUEST_MODULE } from "../../../modules/return_request"

/**
 * GET /admin/return-requests — list all return requests (optionally filtered).
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const returnModule: any = req.scope.resolve(RETURN_REQUEST_MODULE)
  const status = req.query.status as string | undefined

  const filters: any = {}
  if (status) filters.status = status

  const requests = await returnModule.listReturnRequests(filters)
  requests.sort(
    (a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  return res.json({ return_requests: requests, count: requests.length })
}
