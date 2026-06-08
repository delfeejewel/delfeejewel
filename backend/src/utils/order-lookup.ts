/**
 * Shared trimmed-order view for the public guest tracking endpoints
 * (POST /store/orders/lookup and POST /store/orders/track-by-token).
 *
 * Deliberately limited fields (no payment data, partial shipping address) so a
 * guest with only an order number / token can't harvest PII.
 *
 * NOTE: order monetary totals (`total`, `subtotal`, …) are NOT reliable through
 * the Query graph — they come back wrong (e.g. the shipping amount). We resolve
 * them via the Order module service, which computes them correctly (the same
 * source the storefront SDK uses).
 */

import { Modules } from "@medusajs/framework/utils"

type Container = { resolve: (key: any) => any }

/** Fetch a single trimmed order by arbitrary filters (e.g. { id } or { display_id }). */
export async function fetchTrimmedOrder(
  container: Container,
  filters: Record<string, any>
): Promise<any | null> {
  const orderModule: any = container.resolve(Modules.ORDER)

  const [order] = await orderModule.listOrders(filters, {
    relations: ["items", "shipping_address"],
  })

  if (!order) return null

  return {
    id: order.id,
    display_id: order.display_id,
    email: order.email,
    created_at: order.created_at,
    currency_code: order.currency_code,
    status: order.status,
    fulfillment_status: order.fulfillment_status,
    payment_status: order.payment_status,
    total: order.total,
    subtotal: order.subtotal ?? order.item_total,
    shipping_total: order.shipping_total,
    tax_total: order.tax_total,
    discount_total: order.discount_total,
    metadata: order.metadata,
    items: (order.items || []).map((it: any) => ({
      title: it.title,
      quantity: it.quantity,
      unit_price: it.unit_price,
      thumbnail: it.thumbnail,
      product_handle: it.product_handle,
    })),
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
