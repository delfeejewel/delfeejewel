import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * POST /store/orders/lookup
 * Public order lookup for guest tracking. Returns a trimmed view (no payment,
 * limited shipping address) so a guest with a stolen order # can't harvest PII.
 *
 * Body: { display_id: number|string, email: string }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
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

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    filters: { display_id: displayIdNum },
    fields: [
      "id",
      "display_id",
      "email",
      "created_at",
      "currency_code",
      "status",
      "fulfillment_status",
      "payment_status",
      "total",
      "subtotal",
      "shipping_total",
      "discount_total",
      "metadata",
      "items.title",
      "items.quantity",
      "items.unit_price",
      "items.thumbnail",
      "items.product_handle",
      "shipping_address.city",
      "shipping_address.province",
      "shipping_address.postal_code",
      "shipping_address.country_code",
    ],
  })

  const order = orders?.[0] as any
  const norm = (s: string) => s.toLowerCase().trim()
  if (!order || !order.email || norm(order.email) !== norm(email)) {
    // Don't leak existence — same response either way
    return res
      .status(404)
      .json({ message: "We couldn't find an order with those details." })
  }

  return res.json({ order })
}
