"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { getAuthHeaders, getCacheOptions, getOrderToken } from "./cookies"
import { HttpTypes } from "@medusajs/types"

export const retrieveOrder = async (id: string) => {
  const headers: Record<string, string> = {
    ...(await getAuthHeaders()),
  }

  // Guests authorize the (IDOR-hardened) order route with the per-order token
  // minted at checkout. Harmless for logged-in customers (session wins).
  const orderToken = await getOrderToken(id)
  if (orderToken) {
    headers["x-order-token"] = orderToken
  }

  const next = {
    ...(await getCacheOptions("orders")),
    // Safety net for admin-side status changes (fulfilled/shipped) that never
    // call revalidateTag here — without it the order page shows frozen status
    // until the cache-id cookie rotates (~24h).
    revalidate: 30,
  }

  return sdk.client
    .fetch<HttpTypes.StoreOrderResponse>(`/store/orders/${id}`, {
      method: "GET",
      query: {
        fields:
          "*payment_collections.payments,*items,*items.metadata,*items.variant,*items.product,*fulfillments,*fulfillments.labels,*shipping_address,+metadata",
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ order }) => order)
    .catch((err) => medusaError(err))
}

export const listOrders = async (
  limit: number = 10,
  offset: number = 0,
  filters?: Record<string, any>
) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("orders")),
    // Safety net for admin-side status changes (fulfilled/shipped) that never
    // call revalidateTag here — without it the order page shows frozen status
    // until the cache-id cookie rotates (~24h).
    revalidate: 30,
  }

  return sdk.client
    .fetch<HttpTypes.StoreOrderListResponse>(`/store/orders`, {
      method: "GET",
      query: {
        limit,
        offset,
        order: "-created_at",
        fields: "*items,+items.metadata,*items.variant,*items.product,+metadata",
        ...filters,
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ orders }) => orders)
    .catch((err) => medusaError(err))
}

export const createTransferRequest = async (
  state: {
    success: boolean
    error: string | null
    order: HttpTypes.StoreOrder | null
  },
  formData: FormData
): Promise<{
  success: boolean
  error: string | null
  order: HttpTypes.StoreOrder | null
}> => {
  const id = formData.get("order_id") as string

  if (!id) {
    return { success: false, error: "Order ID is required", order: null }
  }

  const headers = await getAuthHeaders()

  return await sdk.store.order
    .requestTransfer(
      id,
      {},
      {
        fields: "id, email",
      },
      headers
    )
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }))
}

export const acceptTransferRequest = async (id: string, token: string) => {
  const headers = await getAuthHeaders()

  return await sdk.store.order
    .acceptTransfer(id, { token }, {}, headers)
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }))
}

/**
 * Public order lookup — order number + email, for the /track-order page.
 * No auth required; returns a trimmed view of the order.
 */
export const lookupOrder = async (
  display_id: number,
  email: string
): Promise<{ order: any | null; error: string | null }> => {
  if (!display_id || !email) {
    return { order: null, error: "Order number and email are required." }
  }
  try {
    const data = await sdk.client.fetch<{ order: any }>(
      `/store/orders/lookup`,
      {
        method: "POST",
        body: { display_id, email },
      }
    )
    return { order: data?.order || null, error: null }
  } catch (e: any) {
    return {
      order: null,
      error:
        e?.message?.includes("404") || e?.message?.includes("couldn't find")
          ? "We couldn't find an order with those details."
          : e?.message || "Lookup failed.",
    }
  }
}

/**
 * Public order lookup via the signed token from the order-confirmation email's
 * "Track your order" link. No auth or email re-entry required.
 */
export const lookupOrderByToken = async (
  token: string
): Promise<{ order: any | null; error: string | null }> => {
  if (!token) {
    return { order: null, error: "Missing tracking token." }
  }
  try {
    const data = await sdk.client.fetch<{ order: any }>(
      `/store/orders/track-by-token`,
      {
        method: "POST",
        body: { token },
      }
    )
    return { order: data?.order || null, error: null }
  } catch (e: any) {
    return {
      order: null,
      error:
        e?.message ||
        "This tracking link is invalid or has expired. Enter your order number and email instead.",
    }
  }
}

export const declineTransferRequest = async (id: string, token: string) => {
  const headers = await getAuthHeaders()

  return await sdk.store.order
    .declineTransfer(id, { token }, {}, headers)
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }))
}
