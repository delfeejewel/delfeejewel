/**
 * Shared trimmed-order view for the public guest tracking endpoints
 * (POST /store/orders/lookup and POST /store/orders/track-by-token).
 *
 * Deliberately limited fields (no payment data, partial shipping address) so a
 * guest with only an order number / token can't harvest PII.
 *
 * Totals come from the Query graph (the same source the order-confirmation
 * email uses, which computes `total` correctly). We treat `total` as the
 * authoritative figure and derive `shipping_total` from it so the breakdown
 * always reconciles, even if an individual component field is off.
 */

import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type Container = { resolve: (key: any) => any }

/** Fetch a single trimmed order by arbitrary filters (e.g. { id } or { display_id }). */
export async function fetchTrimmedOrder(
  container: Container,
  filters: Record<string, any>
): Promise<any | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
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
      "tax_total",
      "discount_total",
      "metadata",
      // Request the full item graph (not just unit_price): Medusa only computes
      // the order `total` correctly when the line-item total fields are loaded.
      // Requesting a narrow subset makes `total` fall back to the shipping amount.
      "items.*",
      "shipping_address.city",
      "shipping_address.province",
      "shipping_address.postal_code",
      "shipping_address.country_code",
    ],
    filters,
  })

  if (!order) return null

  const items = (order.items || []).map((it: any) => ({
    title: it.title,
    quantity: it.quantity,
    unit_price: Number(it.unit_price) || 0,
    thumbnail: it.thumbnail,
    product_handle: it.product_handle,
  }))

  const subtotal = items.reduce(
    (sum: number, it: any) => sum + it.unit_price * (it.quantity || 1),
    0
  )
  const taxTotal = Number(order.tax_total) || 0
  const discountTotal = Number(order.discount_total) || 0
  const total = Number(order.total) || subtotal
  // Derive shipping so subtotal + shipping + tax − discount === total exactly.
  const shippingTotal = Math.max(0, total - subtotal - taxTotal + discountTotal)

  return {
    id: order.id,
    display_id: order.display_id,
    email: order.email,
    created_at: order.created_at,
    currency_code: order.currency_code,
    status: order.status,
    fulfillment_status: order.fulfillment_status,
    payment_status: order.payment_status,
    total,
    subtotal,
    shipping_total: shippingTotal,
    tax_total: taxTotal,
    discount_total: discountTotal,
    metadata: order.metadata,
    items,
    shipping_address: order.shipping_address
      ? {
          city: order.shipping_address.city,
          province: order.shipping_address.province,
          postal_code: order.shipping_address.postal_code,
          country_code: order.shipping_address.country_code,
        }
      : null,
  }
}

export const normalizeEmail = (s: string) => s.toLowerCase().trim()
