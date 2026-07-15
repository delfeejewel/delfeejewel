/**
 * Minimal in-memory fixed-window rate limiter. Good enough for this single-VM
 * deployment — it throttles brute-force / enumeration on public endpoints
 * without a Redis dependency. Counters reset on process restart, which is
 * acceptable for abuse-prevention (not for anything security-critical on its
 * own).
 */
type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

// Opportunistic cleanup so the map doesn't grow unbounded.
let lastSweep = 0
function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k)
  }
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSec: number
}

/**
 * Consume one unit against `key`. Allows up to `max` hits per `windowMs`.
 */
export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: max - 1, retryAfterSec: 0 }
  }

  existing.count += 1
  if (existing.count > max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
    }
  }
  return {
    allowed: true,
    remaining: max - existing.count,
    retryAfterSec: 0,
  }
}

/** Best-effort client IP from common proxy headers, falling back to socket. */
export function clientIp(req: any): string {
  const xf = req?.headers?.["x-forwarded-for"]
  const raw = Array.isArray(xf) ? xf[0] : xf
  if (raw) return String(raw).split(",")[0].trim()
  return req?.ip || req?.socket?.remoteAddress || "unknown"
}
