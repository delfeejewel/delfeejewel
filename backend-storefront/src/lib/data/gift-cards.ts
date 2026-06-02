"use server"

import { sdk } from "@lib/config"
import { revalidateTag } from "next/cache"

import { getAuthHeaders, getCacheTag, getCartId } from "./cookies"

export type GiftCardBalance = {
  code: string
  balance: number
  value: number
  currency_code: string
  status: "active" | "redeemed" | "expired" | "void"
  expires_at: string | null
}

/** Public balance check by code — no auth required. */
export const getGiftCardBalance = async (
  code: string
): Promise<{ data: GiftCardBalance | null; error: string | null }> => {
  if (!code?.trim()) return { data: null, error: "Code is required." }
  try {
    const data = await sdk.client.fetch<GiftCardBalance>(
      `/store/gift-cards/${encodeURIComponent(code.trim())}`,
      { method: "GET" }
    )
    return { data, error: null }
  } catch (e: any) {
    return { data: null, error: e?.message || "Gift card not found." }
  }
}

/** Apply a gift card code to the current cart. */
export const applyGiftCardToCart = async (
  code: string
): Promise<{ success: boolean; error: string | null }> => {
  const cartId = await getCartId()
  if (!cartId) return { success: false, error: "No cart found." }
  if (!code?.trim()) return { success: false, error: "Code is required." }

  const headers = await getAuthHeaders()

  try {
    await sdk.client.fetch(`/store/gift-cards/redeem`, {
      method: "POST",
      headers,
      body: { cart_id: cartId, code: code.trim().toUpperCase() },
    })
    const tag = await getCacheTag("carts")
    if (tag) revalidateTag(tag)
    return { success: true, error: null }
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || "Could not apply gift card.",
    }
  }
}

/** Remove an applied gift card from the cart. */
export const removeGiftCardFromCart = async (
  code: string
): Promise<{ success: boolean; error: string | null }> => {
  const cartId = await getCartId()
  if (!cartId) return { success: false, error: "No cart found." }
  if (!code) return { success: false, error: "Code is required." }

  const headers = await getAuthHeaders()

  try {
    await sdk.client.fetch(`/store/gift-cards/redeem`, {
      method: "DELETE",
      headers,
      body: { cart_id: cartId, code: code.trim().toUpperCase() },
    })
    const tag = await getCacheTag("carts")
    if (tag) revalidateTag(tag)
    return { success: true, error: null }
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || "Could not remove gift card.",
    }
  }
}
