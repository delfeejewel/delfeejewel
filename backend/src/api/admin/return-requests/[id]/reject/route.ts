import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { RETURN_REQUEST_MODULE } from "../../../../../modules/return_request"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const id = req.params.id
  const { reason } = (req.body || {}) as { reason?: string }

  const returnModule: any = req.scope.resolve(RETURN_REQUEST_MODULE)
  const emailService: any = req.scope.resolve("email_notification")
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const [rr] = await returnModule.listReturnRequests({ id })
  if (!rr) return res.status(404).json({ message: "Return request not found" })
  if (rr.status !== "pending") {
    return res
      .status(400)
      .json({ message: `Return is already "${rr.status}".` })
  }

  await returnModule.updateReturnRequests([
    {
      id,
      status: "rejected",
      rejected_at: new Date().toISOString(),
      rejected_reason: reason || null,
    },
  ])

  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: rr.order_id },
    fields: ["display_id", "email", "shipping_address.first_name"],
  })
  const order = (orders as any[])?.[0]
  if (order?.email) {
    await emailService.sendReturnRejectedEmail({
      customer_email: order.email,
      customer_name:
        (order.shipping_address as any)?.first_name || "Customer",
      order_number: order.display_id,
      request_id: id,
      rejected_reason: reason || null,
      brand_name: process.env.BRAND_NAME || "Delfee",
    })
  }

  return res.json({ ok: true, status: "rejected" })
}
