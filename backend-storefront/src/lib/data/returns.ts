"use server"

import { sdk } from "@lib/config"
import { revalidateTag } from "next/cache"
import { HttpTypes } from "@medusajs/types"

import { getAuthHeaders, getCacheOptions, getCacheTag } from "./cookies"
import { getRegion } from "./regions"
import type {
  ReturnReason,
  ReturnRequest,
  ExchangeVariantOption,
} from "@modules/returns/types"

const hasAuth = (
  h: { authorization: string } | {}
): h is { authorization: string } => "authorization" in h

export const createReturnRequest = async (input: {
  order_id: string
  reason: ReturnReason
  message?: string
  type?: "refund" | "exchange"
  items: Array<{
    line_item_id: string
    quantity: number
    reason?: string
    exchange_variant_id?: string
  }>
}): Promise<{ success: boolean; id?: string; error: string | null }> => {
  const headers = await getAuthHeaders()
  if (!hasAuth(headers))
    return { success: false, error: "You must be signed in." }

  try {
    const data = await sdk.client.fetch<{ return_request: { id: string } }>(
      `/store/customers/me/return-requests`,
      { method: "POST", headers, body: input }
    )
    const tag = await getCacheTag("returns")
    if (tag) revalidateTag(tag)
    return { success: true, id: data?.return_request?.id, error: null }
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || "Could not submit your return request.",
    }
  }
}

export const getMyReturnRequests = async (): Promise<ReturnRequest[]> => {
  const headers = await getAuthHeaders()
  if (!hasAuth(headers)) return []
  const next = { ...(await getCacheOptions("returns")) }
  return sdk.client
    .fetch<{ return_requests: ReturnRequest[] }>(
      `/store/customers/me/return-requests`,
      { method: "GET", headers, next, cache: "force-cache" }
    )
    .then((d) => d.return_requests || [])
    .catch(() => [])
}

/**
 * For each product in `productIds`, returns the variants that could be a valid
 * exchange target: same product, in stock. The caller filters by price/current
 * variant on the client side.
 */
export const getExchangeVariantsForProducts = async (
  productIds: string[],
  countryCode: string
): Promise<Record<string, ExchangeVariantOption[]>> => {
  const result: Record<string, ExchangeVariantOption[]> = {}
  if (!productIds.length) return result

  const region = await getRegion(countryCode)
  if (!region) return result

  const headers = await getAuthHeaders()
  const next = { ...(await getCacheOptions("products")) }

  const { products } = await sdk.client.fetch<{
    products: HttpTypes.StoreProduct[]
  }>("/store/products", {
    method: "GET",
    query: {
      id: productIds,
      region_id: region.id,
      fields:
        "id,variants.id,variants.title,variants.inventory_quantity,variants.manage_inventory,variants.allow_backorder,variants.calculated_price",
    },
    headers,
    next,
    cache: "force-cache",
  })

  for (const p of products || []) {
    result[p.id] = ((p.variants || []) as any[])
      .filter((v: any) => {
        if (v.manage_inventory && !v.allow_backorder) {
          const stock = Number(v.inventory_quantity || 0)
          if (stock <= 0) return false
        }
        return true
      })
      .map((v: any) => ({
        id: v.id,
        title: v.title || "",
        price: Number(v.calculated_price?.calculated_amount ?? NaN),
        currency_code: v.calculated_price?.currency_code || region.currency_code,
        in_stock:
          !v.manage_inventory ||
          v.allow_backorder ||
          Number(v.inventory_quantity || 0) > 0,
      }))
  }
  return result
}

export const getMyReturnRequest = async (
  id: string
): Promise<ReturnRequest | null> => {
  const headers = await getAuthHeaders()
  if (!hasAuth(headers)) return null
  const next = { ...(await getCacheOptions("returns")) }
  return sdk.client
    .fetch<{ return_request: ReturnRequest }>(
      `/store/customers/me/return-requests/${id}`,
      { method: "GET", headers, next, cache: "force-cache" }
    )
    .then((d) => d.return_request || null)
    .catch(() => null)
}
