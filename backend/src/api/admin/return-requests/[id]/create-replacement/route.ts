import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createOrderWorkflow } from "@medusajs/medusa/core-flows"

import { RETURN_REQUEST_MODULE } from "../../../../../modules/return_request"
import { actorHasPermission } from "../../../../../lib/rbac"

/**
 * POST /admin/return-requests/:id/create-replacement
 *
 * For exchange-type return requests in "received" state:
 *   1. Pulls the original order for region / sales_channel / addresses.
 *   2. Creates a new zero-charge order with the chosen exchange variants.
 *   3. Stores the new order id in replacement_order_id.
 *   4. Transitions the return request to "completed".
 *   5. Emails the customer the replacement-shipped notification.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!(await actorHasPermission(req, "returns.write"))) {
    return res.status(403).json({ message: "Access denied. Returns permission required." })
  }
  const id = req.params.id
  const returnModule: any = req.scope.resolve(RETURN_REQUEST_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const emailService: any = req.scope.resolve("email_notification")

  const [rr] = await returnModule.listReturnRequests({ id })
  if (!rr) return res.status(404).json({ message: "Return request not found" })
  if (rr.type !== "exchange") {
    return res
      .status(400)
      .json({ message: "Only exchange requests can have a replacement order." })
  }
  if (rr.status !== "received") {
    return res
      .status(400)
      .json({
        message: `Mark the returned items as received before creating the replacement (current: ${rr.status}).`,
      })
  }
  if (rr.replacement_order_id) {
    return res.status(409).json({
      message: "A replacement order has already been created for this request.",
      replacement_order_id: rr.replacement_order_id,
    })
  }

  const { data: rrItems } = await query.graph({
    entity: "return_request_item",
    filters: { return_request_id: id } as any,
    fields: [
      "title",
      "thumbnail",
      "quantity",
      "unit_price",
      "exchange_variant_id",
    ],
  })
  const items = (rrItems as any[]) || []
  if (!items.length || items.some((it) => !it.exchange_variant_id)) {
    return res
      .status(400)
      .json({ message: "Exchange items are missing target variants." })
  }

  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: rr.order_id },
    fields: [
      "id",
      "display_id",
      "email",
      "customer_id",
      "currency_code",
      "region_id",
      "sales_channel_id",
      "shipping_address.*",
      "billing_address.*",
    ],
  })
  const order = (orders as any[])?.[0]
  if (!order) {
    return res
      .status(404)
      .json({ message: "Original order not found for this request." })
  }

  const stripAddress = (a: any) => {
    if (!a) return undefined
    const { id, created_at, updated_at, deleted_at, ...rest } = a
    return rest
  }

  let replacementOrder: any
  try {
    const { result } = await createOrderWorkflow(req.scope as any).run({
      input: {
        region_id: order.region_id,
        customer_id: order.customer_id,
        email: order.email,
        currency_code: order.currency_code,
        sales_channel_id: order.sales_channel_id,
        status: "pending",
        shipping_address: stripAddress(order.shipping_address),
        billing_address:
          stripAddress(order.billing_address) ||
          stripAddress(order.shipping_address),
        items: items.map((it) => ({
          variant_id: it.exchange_variant_id,
          quantity: Number(it.quantity || 1),
          title: it.title,
          unit_price: 0,
        })),
        metadata: {
          replacement_for_order_id: order.id,
          return_request_id: id,
        },
      } as any,
    })
    replacementOrder = result
  } catch (e: any) {
    return res
      .status(500)
      .json({ message: e?.message || "Failed to create replacement order" })
  }

  await returnModule.updateReturnRequests([
    {
      id,
      status: "completed",
      processed_at: new Date().toISOString(),
      replacement_order_id: replacementOrder.id,
    },
  ])

  if (order.email) {
    Promise.resolve()
      .then(() =>
        emailService.sendReplacementShippedEmail({
          customer_email: order.email,
          customer_name:
            (order.shipping_address as any)?.first_name || "Customer",
          order_number: order.display_id,
          replacement_order_number:
            replacementOrder.display_id || replacementOrder.id,
          tracking_url: null,
          brand_name: process.env.BRAND_NAME || "Delfee",
        })
      )
      .catch(() => {})
  }

  return res.json({
    ok: true,
    replacement_order_id: replacementOrder.id,
    replacement_order_display_id:
      replacementOrder.display_id || null,
  })
}
