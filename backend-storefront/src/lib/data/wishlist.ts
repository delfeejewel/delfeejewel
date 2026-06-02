"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { getAuthHeaders, getCacheOptions, getCacheTag } from "./cookies"
import { listProducts } from "./products"

type WishlistItem = {
  id: string
  customer_id: string
  product_id: string
  created_at: string
  updated_at: string
}

const hasAuth = (
  headers: { authorization: string } | {}
): headers is { authorization: string } => "authorization" in headers

/**
 * Product ids on the current customer's wishlist, newest first.
 * Returns an empty list for guests instead of throwing.
 */
export const getWishlistProductIds = async (): Promise<string[]> => {
  const headers = await getAuthHeaders()
  if (!hasAuth(headers)) return []

  const next = {
    ...(await getCacheOptions("wishlist")),
  }

  return sdk.client
    .fetch<{ wishlist: WishlistItem[] }>(`/store/customers/me/wishlist`, {
      method: "GET",
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ wishlist }) => wishlist.map((w) => w.product_id))
    .catch(() => [])
}

/**
 * Priced product data for every item on the customer's wishlist,
 * ordered to match the wishlist (newest saved first).
 */
export const getWishlist = async (
  countryCode: string
): Promise<HttpTypes.StoreProduct[]> => {
  const productIds = await getWishlistProductIds()
  if (!productIds.length) return []

  const {
    response: { products },
  } = await listProducts({
    countryCode,
    queryParams: {
      id: productIds,
      limit: productIds.length,
    },
  })

  const rank = new Map(productIds.map((id, i) => [id, i]))
  return [...products].sort(
    (a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)
  )
}

export const addWishlistItem = async (
  productId: string
): Promise<{ success: boolean; error: string | null }> => {
  const headers = await getAuthHeaders()
  if (!hasAuth(headers)) {
    return { success: false, error: "You must be signed in to save items." }
  }

  try {
    await sdk.client.fetch(`/store/customers/me/wishlist`, {
      method: "POST",
      headers,
      body: { product_id: productId },
    })

    const tag = await getCacheTag("wishlist")
    if (tag) revalidateTag(tag)

    return { success: true, error: null }
  } catch (e: any) {
    return { success: false, error: e?.message || "Could not save item." }
  }
}

export const removeWishlistItem = async (
  productId: string
): Promise<{ success: boolean; error: string | null }> => {
  const headers = await getAuthHeaders()
  if (!hasAuth(headers)) {
    return { success: false, error: "You must be signed in." }
  }

  try {
    await sdk.client.fetch(`/store/customers/me/wishlist/${productId}`, {
      method: "DELETE",
      headers,
    })

    const tag = await getCacheTag("wishlist")
    if (tag) revalidateTag(tag)

    return { success: true, error: null }
  } catch (e: any) {
    return { success: false, error: e?.message || "Could not remove item." }
  }
}
