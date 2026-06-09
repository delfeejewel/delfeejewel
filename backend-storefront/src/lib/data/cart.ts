"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeCartId,
  setCartId,
} from "./cookies"
import { getRegion } from "./regions"
import { getLocale } from "@lib/data/locale-actions"
import { listCartShippingMethods } from "./fulfillment"
import { recomputeGiftCards } from "./gift-cards"

/**
 * Retrieves a cart by its ID. If no ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to retrieve.
 * @returns The cart object if found, or null if not found.
 */
export async function retrieveCart(cartId?: string, fields?: string) {
  const id = cartId || (await getCartId())
  // NOTE: we intentionally do NOT request `*items.product` — the cart/checkout
  // UI never reads `item.product.*` directly (it uses the denormalized
  // `item.product_handle` / `item.product_title` columns and `item.variant`).
  // `*items.product` hydrates the FULL product (every variant, image, option,
  // tag…) per line item, which is the single most expensive part of this
  // fetch. We pull only the two nested variant.product fields the UI actually
  // uses (handle for links/gift-wrap detection, images for the thumbnail
  // fallback).
  fields ??=
    "*items, *region, *items.variant, items.variant.product.handle, items.variant.product.images, *items.thumbnail, *items.metadata, +items.total, *promotions, *credit_lines, +credit_line_subtotal, +shipping_methods.name"

  if (!id) {
    return null
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("carts")),
  }

  return await sdk.client
    .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${id}`, {
      method: "GET",
      query: {
        fields,
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ cart }: { cart: HttpTypes.StoreCart }) => cart)
    .catch(() => null)
}

/**
 * Reorder — fetch a past order and add its items to the current cart.
 * Skips items whose variant is missing / unavailable. Returns a summary
 * so the caller can show "N added · M skipped".
 */
export async function reorderFromOrder(
  orderId: string,
  countryCode: string
): Promise<{
  added: number
  skipped: { title: string; reason: string }[]
  error: string | null
}> {
  if (!orderId) {
    return { added: 0, skipped: [], error: "Order id is required" }
  }

  const headers = await getAuthHeaders()

  // 1. Fetch the original order's items
  let order: any
  try {
    const data = await sdk.client.fetch<HttpTypes.StoreOrderResponse>(
      `/store/orders/${orderId}`,
      {
        method: "GET",
        query: {
          fields: "items.title,items.variant_id,items.quantity",
        },
        headers,
      }
    )
    order = (data as any)?.order
  } catch (e: any) {
    return {
      added: 0,
      skipped: [],
      error: e?.message || "Could not load the order.",
    }
  }
  const items = (order?.items as any[]) || []
  if (!items.length) {
    return { added: 0, skipped: [], error: "This order has no items." }
  }

  // 2. Get / create the active cart
  const cart = await getOrSetCart(countryCode)
  if (!cart) {
    return { added: 0, skipped: [], error: "Could not access cart." }
  }

  // 3. Try to add each item — capture per-item failures (variant deleted,
  //    out of stock + non-backorderable, etc.)
  let added = 0
  const skipped: { title: string; reason: string }[] = []
  for (const it of items) {
    if (!it.variant_id) {
      skipped.push({
        title: it.title || "Item",
        reason: "No longer available",
      })
      continue
    }
    try {
      await sdk.store.cart.createLineItem(
        cart.id,
        { variant_id: it.variant_id, quantity: Number(it.quantity) || 1 },
        {},
        headers
      )
      added++
    } catch (e: any) {
      skipped.push({
        title: it.title || "Item",
        reason: e?.message || "Could not add",
      })
    }
  }

  // 4. Bust the cart caches so the next read sees the new items
  try {
    const [cartTag, fulfillTag] = await Promise.all([
      getCacheTag("carts"),
      getCacheTag("fulfillment"),
    ])
    if (cartTag) revalidateTag(cartTag)
    if (fulfillTag) revalidateTag(fulfillTag)
  } catch {
    /* ignore */
  }

  return { added, skipped, error: null }
}

export async function getOrSetCart(countryCode: string) {
  const [region, cart, headers] = await Promise.all([
    getRegion(countryCode),
    retrieveCart(undefined, "id,region_id"),
    getAuthHeaders(),
  ])

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  let currentCart = cart

  if (!currentCart) {
    const locale = await getLocale()
    const cartResp = await sdk.store.cart.create(
      { region_id: region.id, locale: locale || undefined },
      {},
      headers
    )
    currentCart = cartResp.cart

    await setCartId(currentCart.id)

    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  if (currentCart && currentCart?.region_id !== region.id) {
    await sdk.store.cart.update(currentCart.id, { region_id: region.id }, {}, headers)
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  return currentCart
}

export async function updateCart(data: HttpTypes.StoreUpdateCart) {
  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("No existing cart found, please create one before updating")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .update(cartId, data, {}, headers)
    .then(async ({ cart }: { cart: HttpTypes.StoreCart }) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)

      return cart
    })
    .catch(medusaError)
}

export async function addToCart({
  variantId,
  quantity,
  countryCode,
  metadata,
}: {
  variantId: string
  quantity: number
  countryCode: string
  metadata?: Record<string, unknown>
}) {
  if (!variantId) {
    throw new Error("Missing variant ID when adding to cart")
  }

  const cart = await getOrSetCart(countryCode)

  if (!cart) {
    throw new Error("Error retrieving or creating cart")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .createLineItem(
      cart.id,
      {
        variant_id: variantId,
        quantity,
        ...(metadata ? { metadata } : {}),
      },
      {},
      headers
    )
    .then(async () => {
      await recomputeGiftCards(cart.id)
      const [cartCacheTag, fulfillmentCacheTag] = await Promise.all([
        getCacheTag("carts"),
        getCacheTag("fulfillment"),
      ])
      revalidateTag(cartCacheTag)
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function updateLineItem({
  lineId,
  quantity,
}: {
  lineId: string
  quantity: number
}) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when updating line item")
  }

  const [cartId, headers] = await Promise.all([
    getCartId(),
    getAuthHeaders(),
  ])

  if (!cartId) {
    throw new Error("Missing cart ID when updating line item")
  }

  await sdk.store.cart
    .updateLineItem(cartId, lineId, { quantity }, {}, headers)
    .then(async () => {
      await recomputeGiftCards(cartId)
      const [cartCacheTag, fulfillmentCacheTag] = await Promise.all([
        getCacheTag("carts"),
        getCacheTag("fulfillment"),
      ])
      revalidateTag(cartCacheTag)
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function deleteLineItem(lineId: string) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when deleting line item")
  }

  const [cartId, headers] = await Promise.all([
    getCartId(),
    getAuthHeaders(),
  ])

  if (!cartId) {
    throw new Error("Missing cart ID when deleting line item")
  }

  await sdk.store.cart
    .deleteLineItem(cartId, lineId, {}, headers)
    .then(async () => {
      await recomputeGiftCards(cartId)
      const [cartCacheTag, fulfillmentCacheTag] = await Promise.all([
        getCacheTag("carts"),
        getCacheTag("fulfillment"),
      ])
      revalidateTag(cartCacheTag)
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function setShippingMethod({
  cartId,
  shippingMethodId,
}: {
  cartId: string
  shippingMethodId: string
}) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .addShippingMethod(cartId, { option_id: shippingMethodId }, {}, headers)
    .then(async () => {
      await recomputeGiftCards(cartId)
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
    })
    .catch(medusaError)
}

export async function initiatePaymentSession(
  cart: HttpTypes.StoreCart,
  data: HttpTypes.StoreInitializePaymentSession
) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.payment
    .initiatePaymentSession(cart, data, {}, headers)
    .then(async (resp) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      return resp
    })
    .catch(medusaError)
}

/**
 * Toggles the gift-wrap add-on on the current cart. Adds (or removes) the
 * ₹50 gift-wrap line item server-side via the custom store route, then
 * revalidates the cart cache so totals reflect immediately.
 */
export async function toggleGiftWrap(
  enabled: boolean
): Promise<{ ok: boolean; error: string | null }> {
  const cartId = await getCartId()
  if (!cartId) return { ok: false, error: "No active cart." }

  const headers = await getAuthHeaders()
  try {
    await sdk.client.fetch(`/store/carts/${cartId}/gift-wrap`, {
      method: "POST",
      headers,
      body: { enabled },
    })
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
    return { ok: true, error: null }
  } catch (e: any) {
    return { ok: false, error: e?.message || "Could not update gift wrap." }
  }
}

export async function applyPromotions(codes: string[]) {
  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("No existing cart found")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .update(cartId, { promo_codes: codes }, {}, headers)
    .then(async () => {
      await recomputeGiftCards(cartId)
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function submitPromotionForm(
  currentState: unknown,
  formData: FormData
) {
  const code = formData.get("code") as string
  try {
    await applyPromotions([code])
  } catch (e: any) {
    return e.message
  }
}

// Normalise a 10-digit local number to E.164 with India's fixed +91 ISD code.
const toE164India = (v: FormDataEntryValue | null) => {
  const digits = String(v || "").replace(/\D/g, "").slice(-10)
  return digits ? `+91${digits}` : ""
}

/**
 * Auto-selects a default ("standard") shipping method so the checkout can skip
 * the manual delivery step. Prefers a flat-rate, non-pickup option named
 * "standard", else the cheapest flat-rate option. Throws if none can be set.
 */
async function autoSelectShippingMethod(cartId: string) {
  const methods = await listCartShippingMethods(cartId)
  const shippable = (methods || []).filter(
    (m) => m.service_zone?.fulfillment_set?.type !== "pickup"
  )
  const flat = shippable.filter((m) => m.price_type === "flat")
  const pool = flat.length ? flat : shippable
  if (!pool.length) {
    throw new Error("No shipping method is available for this address.")
  }
  const standard =
    pool.find((m) => /standard/i.test(m.name || "")) ||
    [...pool].sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0))[0]

  await setShippingMethod({ cartId, shippingMethodId: standard.id })
}

// TODO: Pass a POJO instead of a form entity here
export async function setAddresses(currentState: unknown, formData: FormData) {
  try {
    if (!formData) {
      throw new Error("No form data found when setting addresses")
    }
    const cartId = await getCartId()
    if (!cartId) {
      throw new Error("No existing cart found when setting addresses")
    }

    const data = {
      shipping_address: {
        first_name: formData.get("shipping_address.first_name"),
        last_name: formData.get("shipping_address.last_name"),
        address_1: formData.get("shipping_address.address_1"),
        address_2: formData.get("shipping_address.address_2") || "",
        postal_code: formData.get("shipping_address.postal_code"),
        city: formData.get("shipping_address.city"),
        country_code: formData.get("shipping_address.country_code"),
        province: formData.get("shipping_address.province"),
        phone: toE164India(formData.get("shipping_address.phone")),
      },
      email: formData.get("email"),
    } as any

    const sameAsBilling = formData.get("same_as_billing")
    if (sameAsBilling === "on") data.billing_address = data.shipping_address

    if (sameAsBilling !== "on")
      data.billing_address = {
        first_name: formData.get("billing_address.first_name"),
        last_name: formData.get("billing_address.last_name"),
        address_1: formData.get("billing_address.address_1"),
        address_2: formData.get("billing_address.address_2") || "",
        postal_code: formData.get("billing_address.postal_code"),
        city: formData.get("billing_address.city"),
        country_code: formData.get("billing_address.country_code"),
        province: formData.get("billing_address.province"),
        phone: toE164India(formData.get("billing_address.phone")),
      }
    await updateCart(data)

    // Skip the manual delivery step — pick a default shipping method now.
    await autoSelectShippingMethod(cartId)
  } catch (e: any) {
    return e.message
  }

  redirect(
    `/${formData.get("shipping_address.country_code")}/checkout?step=payment`
  )
}

/**
 * Places an order for a cart. If no cart ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to place an order for.
 * @returns The cart object if the order was successful, or null if not.
 */
export async function placeOrder(cartId?: string) {
  const id = cartId || (await getCartId())

  if (!id) {
    throw new Error("No existing cart found when placing an order")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const cartRes = await sdk.store.cart
    .complete(id, {}, headers)
    .then(async (cartRes) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      return cartRes
    })
    .catch(medusaError)

  if (cartRes?.type === "order") {
    const countryCode =
      cartRes.order.shipping_address?.country_code?.toLowerCase()

    const orderCacheTag = await getCacheTag("orders")
    revalidateTag(orderCacheTag)

    removeCartId()
    redirect(`/${countryCode}/order/${cartRes?.order.id}/confirmed`)
  }

  return cartRes.cart
}

/**
 * Updates the countrycode param and revalidates the regions cache
 * @param regionId
 * @param countryCode
 */
export async function updateRegion(countryCode: string, currentPath: string) {
  const cartId = await getCartId()
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  if (cartId) {
    await updateCart({ region_id: region.id })
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  const regionCacheTag = await getCacheTag("regions")
  revalidateTag(regionCacheTag)

  const productsCacheTag = await getCacheTag("products")
  revalidateTag(productsCacheTag)

  redirect(`/${countryCode}${currentPath}`)
}

export async function listCartOptions() {
  const cartId = await getCartId()
  const headers = {
    ...(await getAuthHeaders()),
  }
  const next = {
    ...(await getCacheOptions("shippingOptions")),
  }

  return await sdk.client.fetch<{
    shipping_options: HttpTypes.StoreCartShippingOption[]
  }>("/store/shipping-options", {
    query: { cart_id: cartId },
    next,
    headers,
    cache: "force-cache",
  })
}
