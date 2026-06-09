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
    percent: Number(process.env.COD_UPFRONT_PERCENT) || 10,
    threshold: Number(process.env.COD_UPFRONT_THRESHOLD) || 2000,
    flat_amount: Number(process.env.COD_UPFRONT_FLAT) || 200,
    currency: "inr",
  }
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
