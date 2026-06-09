"use server"

import { sdk } from "@lib/config"
import type { CodPolicy } from "@lib/util/cod"

export type { CodPolicy }

export type CodUpfrontOrder = {
  upfront_required: boolean
  amount: number
  currency: string
  razorpay_order_id?: string
  razorpay_key_id?: string
  /** Set when the token was already paid on a prior attempt — skip the popup. */
  already_paid?: boolean
}

export const getCodPolicy = async (): Promise<CodPolicy | null> => {
  try {
    return await sdk.client.fetch<CodPolicy>(`/store/cod-policy`, {
      method: "GET",
    })
  } catch {
    return null
  }
}

export const createCodUpfrontOrder = async (
  cart_id: string
): Promise<{ data: CodUpfrontOrder | null; error: string | null }> => {
  try {
    const data = await sdk.client.fetch<CodUpfrontOrder>(
      `/store/cod-upfront/create-razorpay-order`,
      { method: "POST", body: { cart_id } }
    )
    return { data, error: null }
  } catch (e: any) {
    return { data: null, error: e?.message || "Could not start the payment." }
  }
}

export const verifyCodUpfront = async (input: {
  cart_id: string
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}): Promise<{ verified: boolean; error: string | null }> => {
  try {
    const data = await sdk.client.fetch<{ verified: boolean }>(
      `/store/cod-upfront/verify`,
      { method: "POST", body: input }
    )
    return { verified: !!data?.verified, error: null }
  } catch (e: any) {
    return {
      verified: false,
      error: e?.message || "Could not verify payment.",
    }
  }
}
