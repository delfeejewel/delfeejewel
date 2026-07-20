import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { shiprocketServiceability } from "../../../lib/shiprocket-serviceability"

/**
 * GET /store/delivery-check?pincode=110001
 *
 * Real delivery check for the storefront PDP widget:
 *  1. Validates the pincode against India Post (rejects non-existent pincodes,
 *     returns the real district/state).
 *  2. Best-effort Shiprocket courier serviceability for a genuine ETA + COD
 *     availability from the store's pickup pincode. If Shiprocket is off/errs,
 *     it still returns a serviceable result with a standard estimate.
 */

type IndiaPostPostOffice = { District?: string; State?: string; Name?: string }
type IndiaPostResult = { Status?: string; PostOffice?: IndiaPostPostOffice[] | null }

async function indiaPostLookup(pincode: string) {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok) return null
    const body = (await res.json()) as IndiaPostResult[]
    const rec = Array.isArray(body) ? body[0] : null
    if (rec?.Status === "Success" && rec.PostOffice && rec.PostOffice.length) {
      const po = rec.PostOffice[0]
      return { city: po.District || "", state: po.State || "" }
    }
    return null
  } catch {
    return null
  }
}

// In-memory per-pincode cache (per backend process; cleared on restart).
// Results are stable, so we cache aggressively — but only briefly when
// Shiprocket didn't answer, so a real ETA fills in on the next check.
type CacheEntry = { body: Record<string, unknown>; exp: number }
const cache = new Map<string, CacheEntry>()
const TTL_FULL = 6 * 60 * 60 * 1000 // 6h — India Post + Shiprocket both answered
const TTL_PARTIAL = 15 * 60 * 1000 // 15m — Shiprocket didn't answer; retry soon
const TTL_INVALID = 24 * 60 * 60 * 1000 // 24h — non-existent pincode
const MAX_ENTRIES = 5000

const cacheGet = (pin: string) => {
  const hit = cache.get(pin)
  if (hit && Date.now() < hit.exp) return hit.body
  if (hit) cache.delete(pin)
  return null
}
const cacheSet = (pin: string, body: Record<string, unknown>, ttl: number) => {
  if (cache.size >= MAX_ENTRIES) cache.clear()
  cache.set(pin, { body, exp: Date.now() + ttl })
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const pincode = String((req.query.pincode as string) || "").trim()

  if (!/^[1-9][0-9]{5}$/.test(pincode)) {
    return res.json({ serviceable: false, invalid: true })
  }

  const cached = cacheGet(pincode)
  if (cached) {
    res.setHeader("x-delivery-cache", "hit")
    return res.json(cached)
  }
  res.setHeader("x-delivery-cache", "miss")

  // 1. Real pincode validation + location
  const loc = await indiaPostLookup(pincode)
  if (!loc) {
    // network error vs genuinely-not-found are hard to tell apart here; cache
    // "invalid" only briefly so a transient India Post outage self-heals.
    const body = { serviceable: false, invalid: true }
    cacheSet(pincode, body, TTL_PARTIAL)
    return res.json(body)
  }

  // 2. Best-effort real courier serviceability (ETA + COD)
  const sr = await shiprocketServiceability(pincode).catch(() => null)

  let body: Record<string, unknown>
  if (sr && sr.serviceable === false) {
    body = {
      serviceable: false,
      city: loc.city,
      state: loc.state,
      reason: "not_serviceable",
    }
  } else {
    body = {
      serviceable: true,
      city: loc.city,
      state: loc.state,
      etdDays: sr?.etdDays ?? null,
      cod: sr ? !!sr.cod : true,
      courier: sr?.courier ?? null,
    }
  }

  // Full TTL only when Shiprocket contributed; otherwise retry soon for the ETA.
  cacheSet(pincode, body, sr ? TTL_FULL : TTL_PARTIAL)
  return res.json(body)
}
