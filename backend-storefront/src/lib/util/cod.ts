/**
 * COD upfront-token policy + computation — mirrors the backend
 * (backend/src/utils/cod.ts). The backend is authoritative for the actual
 * Razorpay charge; this is used only to render the checkout breakdown.
 */

export type CodPolicy = {
  percent: number
  threshold: number
  flat_amount: number
  currency: string
}

/** Upfront COD token in major units (₹). Keep in sync with the backend. */
export function computeCodToken(total: number, policy: CodPolicy): number {
  const t = Number(total) || 0
  if (t <= 0) return 0
  const raw =
    t >= policy.threshold
      ? Math.round((t * policy.percent) / 100)
      : policy.flat_amount
  return Math.min(raw, t) // never exceed the order total
}
