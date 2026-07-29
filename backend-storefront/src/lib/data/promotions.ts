import { sdk } from "@lib/config"

export type StoreCoupon = {
  id: string
  code: string
  description: string | null
  kind: "percentage" | "fixed"
  value: number
  target: string
  currency_code: string | null
  first_order_only: boolean
  ends_at: string | null
}

/**
 * Publicly advertisable coupon codes, optionally narrowed to the product being
 * viewed (the backend drops codes scoped to other categories/collections).
 * Used by the PDP "Offers & Coupons" section. Cached for 5 minutes — coupons
 * change rarely and this runs on every product page render.
 */
export async function listStoreCoupons(
  productId?: string
): Promise<StoreCoupon[]> {
  try {
    const { coupons } = await sdk.client.fetch<{ coupons: StoreCoupon[] }>(
      "/store/promotions",
      {
        method: "GET",
        query: productId ? { product_id: productId } : {},
        next: { revalidate: 300 },
      }
    )
    return coupons || []
  } catch {
    // An offers strip is never worth failing a product page over.
    return []
  }
}
