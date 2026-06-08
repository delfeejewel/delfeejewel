"use server"

/**
 * Looks up an Indian PIN code and returns the City (district) + State.
 * Runs server-side via a server action so it isn't subject to browser CORS /
 * CSP restrictions. Uses the free India Post API (no key required).
 */
export async function lookupIndianPincode(
  pin: string
): Promise<{ city: string; state: string } | null> {
  const code = String(pin || "").replace(/\D/g, "")
  if (code.length !== 6) return null

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${code}`, {
      // PIN → location is effectively static; cache for a day.
      next: { revalidate: 86400 },
    })
    if (!res.ok) return null
    const json = await res.json()
    const po = json?.[0]?.PostOffice?.[0]
    if (!po) return null
    return {
      city: po.District || "",
      state: po.State || "",
    }
  } catch {
    return null
  }
}
