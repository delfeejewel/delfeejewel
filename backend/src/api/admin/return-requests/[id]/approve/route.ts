import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { RETURN_REQUEST_MODULE } from "../../../../../modules/return_request"
import { actorHasPermission } from "../../../../../lib/rbac"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!(await actorHasPermission(req, "returns.write"))) {
    return res.status(403).json({ message: "Access denied. Returns permission required." })
  }

  const id = req.params.id
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
    { id, status: "approved", approved_at: new Date().toISOString() },
  ])

  // Email — needs order email + display_id
  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: rr.order_id },
    fields: ["display_id", "email", "shipping_address.first_name"],
  })
  const order = (orders as any[])?.[0]
  if (order?.email) {
    if (rr.type === "exchange") {
      const { data: rrItems } = await query.graph({
        entity: "return_request_item",
        filters: { return_request_id: id } as any,
        fields: [
          "title",
          "quantity",
          "variant_id",
          "exchange_variant_id",
        ],
      })
      const fromIds = (rrItems as any[]).map((i) => i.variant_id).filter(Boolean)
      const toIds = (rrItems as any[]).map((i) => i.exchange_variant_id).filter(Boolean)
      const { data: variants } = await query.graph({
        entity: "variant",
        filters: { id: [...new Set([...fromIds, ...toIds])] } as any,
        fields: ["id", "title"],
      })
      const variantTitle = new Map<string, string>(
        (variants as any[]).map((v) => [v.id, v.title || ""])
      )
      const exchangeItems = (rrItems as any[]).map((it: any) => ({
        title: it.title,
        from_variant: variantTitle.get(it.variant_id || "") || "current",
        to_variant: variantTitle.get(it.exchange_variant_id || "") || "new",
        quantity: it.quantity,
      }))
      await emailService.sendExchangeApprovedEmail({
        customer_email: order.email,
        customer_name:
          (order.shipping_address as any)?.first_name || "Customer",
        order_number: order.display_id,
        request_id: id,
        items: exchangeItems,
        brand_name: process.env.BRAND_NAME || "Delfee",
      })
    } else {
      await emailService.sendReturnApprovedEmail({
        customer_email: order.email,
        customer_name:
          (order.shipping_address as any)?.first_name || "Customer",
        order_number: order.display_id,
        request_id: id,
        brand_name: process.env.BRAND_NAME || "Delfee",
      })
    }
  }

  return res.json({ ok: true, status: "approved" })
}
