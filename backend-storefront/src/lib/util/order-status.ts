type OrderLike = {
  fulfillment_status?: string | null
  metadata?: Record<string, any> | null
}

/**
 * Map a Shiprocket `current_status` string to a known fulfillment-status key.
 * Returns null for statuses we'd rather let Medusa's own status describe.
 */
function fromShiprocket(raw: string): string | null {
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
 * This store fulfils through Shiprocket, so the live carrier status — recorded
 * in `order.metadata.shiprocket_status` by the Shiprocket webhook — is the
 * source of truth. Medusa's own `fulfillment_status` is the fallback.
 */
export function getDisplayFulfillmentStatus(order: OrderLike): string {
  const shiprocket = order?.metadata?.shiprocket_status
  if (typeof shiprocket === "string") {
    const mapped = fromShiprocket(shiprocket)
    if (mapped) return mapped
  }
  return order?.fulfillment_status || "not_fulfilled"
}
