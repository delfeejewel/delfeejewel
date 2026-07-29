import { courierStatus } from "@lib/util/courier"

type OrderLike = {
  fulfillment_status?: string | null
  metadata?: Record<string, any> | null
}

/**
 * Map a courier's free-text status string to a known fulfillment-status key.
 * Returns null for statuses we'd rather let Medusa's own status describe.
 *
 * The vocabulary here matches Shiprocket's `current_status` values, which most
 * Indian aggregators mirror closely. A courier with different wording needs
 * its terms adding rather than a separate mapper.
 */
function fromCarrierStatus(raw: string): string | null {
  const s = raw.toLowerCase().trim()
  if (!s) return null
  if (s.includes("rto")) return null // return-to-origin — leave Medusa's status
  if (s.includes("delivered")) return "delivered"
  if (s.includes("out for delivery")) return "shipped"
  if (s.includes("transit")) return "shipped"
  if (s.includes("shipped") || s.includes("picked") || s.includes("dispatch")) {
    return "shipped"
  }
  if (s.includes("cancel")) return "canceled"
  return null
}

/**
 * The fulfillment status to display for an order.
 *
 * The live carrier status recorded on the order by the courier webhook is the
 * source of truth; Medusa's own `fulfillment_status` is the fallback. Read via
 * courierStatus() so the key stays vendor-neutral — see @lib/util/courier.
 */
export function getDisplayFulfillmentStatus(order: OrderLike): string {
  const carrierStatus = courierStatus(order?.metadata)
  if (carrierStatus) {
    const mapped = fromCarrierStatus(carrierStatus)
    if (mapped) return mapped
  }
  return order?.fulfillment_status || "not_fulfilled"
}
