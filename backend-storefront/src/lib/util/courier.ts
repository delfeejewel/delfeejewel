/**
 * Courier metadata and tracking links.
 *
 * The backend writes shipment state onto `order.metadata` from the courier
 * webhook. Those keys were named after the vendor (`shiprocket_status`,
 * `shiprocket_courier`, `shiprocket_history`), and the track-order page linked
 * to a hardcoded shiprocket.co URL — so both the data we read and the link we
 * show a customer were tied to one supplier.
 *
 * These readers accept the vendor-neutral `courier_*` keys AND the legacy
 * `shiprocket_*` ones, so live orders placed before any rename keep working.
 * When the backend is switched to write `courier_*` and the existing rows are
 * backfilled, the legacy fallbacks here can be deleted and nothing else moves.
 */

export type OrderLikeMetadata = Record<string, unknown> | null | undefined

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v : undefined

/** Current shipment status as reported by the courier, e.g. "In Transit". */
export function courierStatus(meta: OrderLikeMetadata): string | undefined {
  const m = (meta || {}) as any
  return str(m.courier_status) ?? str(m.shiprocket_status)
}

/** Courier company handling the shipment, e.g. "Delhivery". */
export function courierName(meta: OrderLikeMetadata): string | undefined {
  const m = (meta || {}) as any
  return str(m.courier_name) ?? str(m.shiprocket_courier)
}

/** Airway bill / consignment number. */
export function courierAwb(meta: OrderLikeMetadata): string | undefined {
  const m = (meta || {}) as any
  return str(m.awb)
}

/** Scan history, newest first. Shape is passed straight to the timeline. */
export function courierHistory(meta: OrderLikeMetadata): any[] {
  const m = (meta || {}) as any
  const h = m.courier_history ?? m.shiprocket_history
  return Array.isArray(h) ? h : []
}

/**
 * Public tracking page for a consignment.
 *
 * Resolution order:
 *   1. `metadata.tracking_url` — whatever the backend recorded for this
 *      shipment. Always correct, including for couriers we don't know about.
 *   2. A known courier's own tracking page, matched on the courier name.
 *   3. The aggregator's lookup, which accepts an AWB from any of its couriers.
 *
 * Returns undefined when there is no AWB, so callers can hide the link rather
 * than render one that goes nowhere.
 */
export function trackingUrl(meta: OrderLikeMetadata): string | undefined {
  const m = (meta || {}) as any

  const explicit = str(m.tracking_url)
  if (explicit) return explicit

  const awb = courierAwb(meta)
  if (!awb) return undefined

  const id = encodeURIComponent(awb)
  const name = (courierName(meta) || "").toLowerCase()

  if (name.includes("delhivery")) return `https://www.delhivery.com/track/package/${id}`
  if (name.includes("bluedart") || name.includes("blue dart"))
    return `https://www.bluedart.com/tracking?trackFor=0&trackNo=${id}`
  if (name.includes("dtdc")) return `https://www.dtdc.in/tracking/shipment-tracking?awb=${id}`
  if (name.includes("xpressbees")) return `https://www.xpressbees.com/shipment/tracking?awb=${id}`
  if (name.includes("ecom")) return `https://ecomexpress.in/tracking/?awb_field=${id}`
  if (name.includes("shadowfax")) return `https://tracker.shadowfax.in/#/track/${id}`
  if (name.includes("india post") || name.includes("speed post"))
    return `https://www.indiapost.gov.in/_layouts/15/DOP.Portal.Tracking/TrackConsignment.aspx?logisticsId=${id}`

  return `https://shiprocket.co/tracking/${id}`
}
