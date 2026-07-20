import { sdk } from "@lib/config"

export type DeliveryCheck = {
  serviceable: boolean
  invalid?: boolean
  city?: string
  state?: string
  etdDays?: number | null
  cod?: boolean
  courier?: string | null
  reason?: string
}

/**
 * Real delivery/serviceability check for a pincode (India Post validation +
 * Shiprocket courier ETA/COD). Client-safe — the SDK adds the publishable key.
 */
export async function checkDelivery(pincode: string): Promise<DeliveryCheck> {
  return sdk.client.fetch<DeliveryCheck>("/store/delivery-check", {
    method: "GET",
    query: { pincode },
  })
}
