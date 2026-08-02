/**
 * COD upfront-token policy + computation. The token is the amount a customer
 * pays now (via Razorpay) to confirm a Cash-on-Delivery order; the balance is
 * collected on delivery.
 *
 * Rule (defaults, overridable via env):
 *   - order total ≥ threshold (₹2000)  → token = percent (10%) of the total
 *   - order total <  threshold         → token = flat_amount (₹200)
 *   - token is always capped at the order total (tiny orders just prepay fully)
 */

export type CodPolicy = {
  /** % of the total collected upfront when total ≥ threshold */
  percent: number
  /** at/above this total use `percent`; below it use `flat_amount` */
  threshold: number
  /** flat token (major units) collected when total < threshold */
  flat_amount: number
  currency: string
}

export function getCodPolicy(): CodPolicy {
  return {
    // 20%, not 10%: the courier's COD charge is levied on the BALANCE the
    // courier collects, so a larger token shrinks the cost base itself
    // rather than passing the cost on. It also raises customer commitment,
    // which is the main lever against RTO on high-value jewellery.
    percent: Number(process.env.COD_UPFRONT_PERCENT) || 20,
    threshold: Number(process.env.COD_UPFRONT_THRESHOLD) || 2000,
    flat_amount: Number(process.env.COD_UPFRONT_FLAT) || 200,
    currency: "inr",
  }
}

/**
 * ── COD handling fee, banded ────────────────────────────────────────────────
 *
 * Shiprocket bills us for COD as `max(flat, multiplier × collectable)`, which
 * for our Blue Dart rate card measures as:
 *
 *     max(₹53.55, 2.352% × collectable)      (verified against the live API)
 *
 * A single flat fee therefore cannot work: it breaks even at ~₹2,162 of
 * collectable, and 81% of the published catalogue is priced above that. Bands
 * track the cost closely enough while staying quotable — unlike a raw
 * percentage, "₹150" is a number a customer can hold in their head.
 *
 * Sized against a 20% upfront token, worst case is about −₹28 at the top of
 * the last band; most of the range is slightly positive. Full recovery is
 * deliberately NOT the goal — matching the courier exactly would mean a ~₹700
 * fee on a ₹25k order, which costs more in lost conversion than it recovers.
 *
 * Each band is a separate variant on the `cod-fee` product, since Medusa
 * prices line items per variant. `sku` is what the cart route resolves.
 */
export type CodFeeBand = {
  /** inclusive upper bound of merchandise value (₹) this band applies to */
  max: number
  /** gross, tax-inclusive fee (₹) — taxed at 18% as a service */
  amount: number
  sku: string
  /** value of the product's "Type" option for this band's variant */
  option: string
}

export const COD_FEE_BANDS: CodFeeBand[] = [
  { max: 2500, amount: 60, sku: "COD-FEE-INR-60", option: "Standard" },
  { max: 6000, amount: 150, sku: "COD-FEE-INR-150", option: "Mid" },
  { max: 15000, amount: 300, sku: "COD-FEE-INR-300", option: "High" },
]

/**
 * Above this merchandise value Cash on Delivery is not offered at all.
 *
 * The binding risk here is not the handling fee — it is RTO. A refused
 * high-value jewellery parcel costs forward freight, the courier's RTO charge,
 * and a round trip for goods worth more than everything else combined. The cap
 * also happens to bound the fee shortfall, since it sits at the top band.
 */
export const codMaxOrderValue = (): number =>
  Number(process.env.COD_MAX_ORDER_VALUE) || 15000

/** Is COD offerable for this merchandise value (fee and shipping excluded)? */
export const codAllowed = (merchandiseValue: number): boolean =>
  (Number(merchandiseValue) || 0) <= codMaxOrderValue()

/**
 * The band a cart falls in, or null when COD isn't offerable at all.
 *
 * `merchandiseValue` MUST exclude any COD fee already on the cart — otherwise
 * adding the fee can push the cart into the next band, which would then change
 * the fee, which changes the band again.
 */
export function codFeeBandFor(merchandiseValue: number): CodFeeBand | null {
  const v = Number(merchandiseValue) || 0
  if (!codAllowed(v)) return null
  return COD_FEE_BANDS.find((b) => v <= b.max) ?? null
}

/** Upfront token to collect for a COD order, in major units (₹). */
export function codTokenAmount(total: number, policy: CodPolicy): number {
  const t = Number(total) || 0
  if (t <= 0) return 0
  const raw =
    t >= policy.threshold
      ? Math.round((t * policy.percent) / 100)
      : policy.flat_amount
  return Math.min(raw, t) // never collect more than the order total
}
