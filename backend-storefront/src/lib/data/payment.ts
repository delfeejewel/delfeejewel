"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { HttpTypes } from "@medusajs/types"

/**
 * Providers that exist on the backend but must never be offered to customers.
 * `pp_system_default` is Medusa's built-in test/manual provider — selecting it
 * would place a fully-unpaid order, so it's hidden from checkout.
 */
const HIDDEN_PROVIDER_PREFIXES = ["pp_system_default"]

export const listCartPaymentMethods = async (regionId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("payment_providers")),
    // Safety net so enabling/disabling COD or Razorpay reaches checkout
    // without waiting ~24h (this tag is never busted on admin changes).
    revalidate: 60,
  }

  return sdk.client
    .fetch<HttpTypes.StorePaymentProviderListResponse>(
      `/store/payment-providers`,
      {
        method: "GET",
        query: { region_id: regionId },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then(({ payment_providers }) =>
      payment_providers
        .filter(
          (p) =>
            !HIDDEN_PROVIDER_PREFIXES.some((prefix) => p.id.startsWith(prefix))
        )
        .sort((a, b) => {
          return a.id > b.id ? 1 : -1
        })
    )
    .catch(() => {
      return null
    })
}
