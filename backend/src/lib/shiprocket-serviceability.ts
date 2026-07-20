/**
 * Lightweight Shiprocket courier-serviceability lookup for the storefront
 * "Check Delivery" widget. Uses the same credentials as the fulfillment
 * provider (SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD) but is standalone so a
 * public store route can call it without resolving the provider service.
 *
 * Returns null when Shiprocket isn't configured or the call fails — callers
 * should fall back gracefully (the delivery check still works via India Post).
 */

const API_BASE = "https://apiv2.shiprocket.in/v1/external"

let cachedToken: string | null = null
let tokenExpiry = 0

async function getToken(): Promise<string | null> {
  if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) return null
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD,
      }),
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.token) return null
    cachedToken = data.token
    tokenExpiry = Date.now() + 23 * 60 * 60 * 1000 // 23h
    return cachedToken
  } catch {
    return null
  }
}

export type Serviceability = {
  serviceable: boolean
  etdDays?: number
  cod?: boolean
  courier?: string
}

export async function shiprocketServiceability(
  deliveryPincode: string,
  weightKg = 0.3
): Promise<Serviceability | null> {
  const token = await getToken()
  if (!token) return null
  const pickup = process.env.SHIPROCKET_PICKUP_PINCODE || "136118"
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 6000)
    // cod=0 → return ALL couriers (each with its own `cod` capability flag),
    // so we can tell COD-available from prepaid-only. Querying cod=1 would
    // return only COD couriers, making COD look always-available.
    const res = await fetch(
      `${API_BASE}/courier/serviceability/?pickup_postcode=${pickup}&delivery_postcode=${deliveryPincode}&weight=${weightKg}&cod=0`,
      { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal }
    )
    clearTimeout(timer)
    if (!res.ok) return null
    const data = await res.json()
    const couriers: any[] = data?.data?.available_courier_companies || []
    if (!couriers.length) return { serviceable: false }
    couriers.sort(
      (a, b) =>
        (Number(a.estimated_delivery_days) || 99) -
        (Number(b.estimated_delivery_days) || 99)
    )
    const best = couriers[0]
    const etd = Number(best?.estimated_delivery_days)
    const cod = couriers.some((c) => Number(c.cod) === 1)
    return {
      serviceable: true,
      etdDays: Number.isFinite(etd) && etd > 0 ? etd : undefined,
      cod,
      courier: best?.courier_name,
    }
  } catch {
    return null
  }
}
