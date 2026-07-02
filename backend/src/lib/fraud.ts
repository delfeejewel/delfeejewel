/**
 * Fraud-detection rules engine (pure, in-house, no third party).
 *
 * `scoreOrder()` takes a normalized FraudContext (assembled by
 * lib/fraud-context.ts) and returns a risk score, a band, and the
 * human-readable reasons that drove it. It does ZERO I/O so it stays
 * cheap to unit-test and reason about.
 *
 * Philosophy: score & flag, never auto-block. A high score routes the
 * order to the admin "Orders to Review" queue; an operator makes the
 * call before the order is pushed to fulfilment.
 *
 * All weights/thresholds are env-tunable via getFraudConfig() so the
 * store can tighten/loosen without a code change (mirrors getCodPolicy()).
 */

export type FraudBand = "low" | "review" | "high"

export type FraudConfig = {
  /** order total (major units, ₹) at/above which "high value" rules trip */
  highValue: number
  /** average-order-value ceiling; totals above this are statistical outliers */
  aovCeiling: number
  /** velocity: look-back window in hours */
  velocityWindowHrs: number
  /** velocity: this many+ orders from the same buyer in the window is risky */
  velocityCount: number
  /** repeated failed payments: this many+ failed sessions is risky */
  failedPaymentCount: number
  /** score at/above this → flagged for review */
  scoreReview: number
  /** score at/above this → high-priority review */
  scoreHigh: number
  /** per-rule point weights */
  weights: {
    firstTimeHighValue: number
    codNoToken: number
    velocity: number
    failedPayments: number
    addressMismatch: number
    guestHighValue: number
    aovOutlier: number
  }
}

export function getFraudConfig(): FraudConfig {
  const num = (v: string | undefined, d: number) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : d
  }
  return {
    highValue: num(process.env.FRAUD_HIGH_VALUE_INR, 50000),
    aovCeiling: num(process.env.FRAUD_AOV_CEILING_INR, 100000),
    velocityWindowHrs: num(process.env.FRAUD_VELOCITY_WINDOW_HRS, 24),
    velocityCount: num(process.env.FRAUD_VELOCITY_COUNT, 3),
    failedPaymentCount: num(process.env.FRAUD_FAILED_PAYMENT_COUNT, 3),
    scoreReview: num(process.env.FRAUD_SCORE_REVIEW, 30),
    scoreHigh: num(process.env.FRAUD_SCORE_HIGH, 60),
    weights: {
      firstTimeHighValue: num(process.env.FRAUD_W_FIRST_TIME, 25),
      codNoToken: num(process.env.FRAUD_W_COD_NO_TOKEN, 20),
      velocity: num(process.env.FRAUD_W_VELOCITY, 30),
      failedPayments: num(process.env.FRAUD_W_FAILED_PAYMENTS, 30),
      addressMismatch: num(process.env.FRAUD_W_ADDRESS_MISMATCH, 15),
      guestHighValue: num(process.env.FRAUD_W_GUEST_HIGH_VALUE, 15),
      aovOutlier: num(process.env.FRAUD_W_AOV_OUTLIER, 20),
    },
  }
}

/**
 * Normalized inputs for scoring. lib/fraud-context.ts builds this from the
 * order, the buyer's history, the cart's payment sessions, and the addresses.
 * Everything here is already available in our own database — no external call.
 */
export type FraudContext = {
  /** order total in major units (₹) */
  total: number
  /** non-canceled orders this buyer placed BEFORE this one (by customer_id or email) */
  priorOrderCount: number
  /** true if no customer account is attached (guest checkout) */
  isGuest: boolean
  /** true if this is a Cash-on-Delivery order */
  isCod: boolean
  /** COD upfront token actually paid (major units); 0 if none */
  codUpfrontPaid: number
  /** orders from the same buyer within the velocity window (INCLUDING this one) */
  recentOrderCount: number
  /** count of failed/errored/canceled payment sessions on this cart's collection */
  failedPaymentSessions: number
  /** shipping vs billing address fields, for mismatch detection */
  shipping?: AddressLite
  billing?: AddressLite
}

export type AddressLite = {
  first_name?: string | null
  last_name?: string | null
  city?: string | null
  postal_code?: string | null
  country_code?: string | null
}

export type FraudResult = {
  score: number
  band: FraudBand
  reasons: string[]
  /** machine-readable rule keys that fired, for filtering/analytics */
  rules: string[]
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`

/** Normalize a name/city string for loose comparison. */
const norm = (s?: string | null) =>
  (s || "").trim().toLowerCase().replace(/\s+/g, " ")

function addressesMismatch(a?: AddressLite, b?: AddressLite): boolean {
  if (!a || !b) return false
  const nameA = `${norm(a.first_name)} ${norm(a.last_name)}`.trim()
  const nameB = `${norm(b.first_name)} ${norm(b.last_name)}`.trim()
  // Compare on the fields a fraudster is most likely to diverge on. Pincode
  // and recipient name are the strongest; city backs them up.
  const pinDiff =
    !!norm(a.postal_code) &&
    !!norm(b.postal_code) &&
    norm(a.postal_code) !== norm(b.postal_code)
  const nameDiff = !!nameA && !!nameB && nameA !== nameB
  const cityDiff =
    !!norm(a.city) && !!norm(b.city) && norm(a.city) !== norm(b.city)
  // Require at least two divergent fields so a typo alone doesn't trip it.
  return [pinDiff, nameDiff, cityDiff].filter(Boolean).length >= 2
}

/**
 * Run every rule and accumulate the score. Each rule is independent and adds
 * its weight when it fires; the band is derived from the total.
 */
export function scoreOrder(
  ctx: FraudContext,
  config: FraudConfig = getFraudConfig()
): FraudResult {
  const w = config.weights
  let score = 0
  const reasons: string[] = []
  const rules: string[] = []

  const fire = (rule: string, points: number, reason: string) => {
    score += points
    rules.push(rule)
    reasons.push(reason)
  }

  const isFirstTime = ctx.priorOrderCount === 0
  const isHighValue = ctx.total >= config.highValue

  // R1 — first-time buyer placing a high-value order.
  if (isFirstTime && isHighValue) {
    fire(
      "first_time_high_value",
      w.firstTimeHighValue,
      `First-time buyer placing a ${inr(ctx.total)} order`
    )
  }

  // R2 — high-value COD with no upfront token paid (no payment commitment).
  if (ctx.isCod && isHighValue && ctx.codUpfrontPaid <= 0) {
    fire(
      "cod_no_token",
      w.codNoToken,
      `${inr(ctx.total)} COD order with no upfront token paid`
    )
  }

  // R3 — order velocity: several orders from the same buyer in a short window.
  if (ctx.recentOrderCount >= config.velocityCount) {
    fire(
      "velocity",
      w.velocity,
      `${ctx.recentOrderCount} orders from this buyer in ${config.velocityWindowHrs}h`
    )
  }

  // R4 — repeated failed payments before success (card-testing pattern).
  if (ctx.failedPaymentSessions >= config.failedPaymentCount) {
    fire(
      "failed_payments",
      w.failedPayments,
      `${ctx.failedPaymentSessions} failed payment attempts on this checkout`
    )
  }

  // R5 — shipping address diverges from billing on multiple fields.
  if (addressesMismatch(ctx.shipping, ctx.billing)) {
    fire(
      "address_mismatch",
      w.addressMismatch,
      "Shipping and billing addresses differ significantly"
    )
  }

  // R6 — guest checkout on a high-value order (no account accountability).
  if (ctx.isGuest && isHighValue) {
    fire(
      "guest_high_value",
      w.guestHighValue,
      `Guest checkout on a ${inr(ctx.total)} order`
    )
  }

  // R9 — order total is a statistical outlier vs the AOV ceiling.
  if (ctx.total >= config.aovCeiling) {
    fire(
      "aov_outlier",
      w.aovOutlier,
      `Order total ${inr(ctx.total)} far exceeds typical orders`
    )
  }

  const band: FraudBand =
    score >= config.scoreHigh
      ? "high"
      : score >= config.scoreReview
      ? "review"
      : "low"

  return { score, band, reasons, rules }
}
