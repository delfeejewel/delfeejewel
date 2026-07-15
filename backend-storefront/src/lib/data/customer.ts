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
  removeAuthToken,
  removeCartId,
  setAuthToken,
} from "./cookies"

export const retrieveCustomer =
  async (): Promise<HttpTypes.StoreCustomer | null> => {
    const authHeaders = await getAuthHeaders()

    // getAuthHeaders returns {} (which is truthy) for guests — check for the
    // actual token, otherwise every anonymous render fires a doomed 401 to
    // /store/customers/me.
    if (!("authorization" in authHeaders)) return null

    const headers = {
      ...authHeaders,
    }

    const next = {
      ...(await getCacheOptions("customers")),
      revalidate: 60,
    }

    return await sdk.client
      .fetch<{ customer: HttpTypes.StoreCustomer }>(`/store/customers/me`, {
        method: "GET",
        query: {
          fields: "*orders",
        },
        headers,
        next,
        cache: "force-cache",
      })
      .then(({ customer }) => customer)
      .catch(() => null)
  }

export const updateCustomer = async (body: HttpTypes.StoreUpdateCustomer) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const updateRes = await sdk.store.customer
    .update(body, {}, headers)
    .then(({ customer }) => customer)
    .catch(medusaError)

  const cacheTag = await getCacheTag("customers")
  revalidateTag(cacheTag)

  return updateRes
}

/**
 * Request an email-OTP code for post-checkout account creation.
 * Called before the user can submit the create-account form.
 */
export async function requestSignupOtp(
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!email) {
    return { success: false, error: "Email is required." }
  }
  try {
    await sdk.client.fetch(`/store/otp/request`, {
      method: "POST",
      body: { email },
    })
    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      error:
        error?.message || "We couldn't send the code. Please try again shortly.",
    }
  }
}

/**
 * Standard registration, gated by an email-OTP code. The backend verifies the
 * code, creates the account, links ALL prior guest orders for that email, and
 * returns a session token. The active guest cart is then transferred to the new
 * customer. Used by the /account register form (two-step: details → code).
 */
export async function signupWithOtp(data: {
  email: string
  password: string
  first_name: string
  last_name: string
  phone?: string
  code: string
}): Promise<{ success: boolean; error?: string; linked_orders?: number }> {
  if (!data.code) {
    return { success: false, error: "Please enter the verification code we emailed you." }
  }
  try {
    const { token, linked_orders } = await sdk.client.fetch<{
      token: string
      linked_orders: number
    }>(`/store/account/create-verified`, {
      method: "POST",
      body: data,
    })

    await setAuthToken(token)

    const customerCacheTag = await getCacheTag("customers")
    revalidateTag(customerCacheTag)

    // Attach the in-progress guest cart to the new account (best-effort).
    try {
      await transferCart()
    } catch {
      // non-fatal — the account is created and signed in regardless
    }

    return { success: true, linked_orders }
  } catch (error: any) {
    return {
      success: false,
      error:
        error?.message ||
        "We couldn't create your account. Please check the code and try again.",
    }
  }
}

/**
 * Request a password-reset code for a forgotten password. The backend only
 * issues a code when a registered account exists, but always responds 200 so
 * we never reveal whether the email has an account.
 */
export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!email) {
    return { success: false, error: "Email is required." }
  }
  try {
    await sdk.client.fetch(`/store/account/reset-password/request`, {
      method: "POST",
      body: { email },
    })
    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      error:
        error?.message || "We couldn't send the code. Please try again shortly.",
    }
  }
}

/** Verify the emailed code and set a new password (forgotten-password flow). */
export async function resetPassword(data: {
  email: string
  code: string
  password: string
}): Promise<{ success: boolean; error?: string }> {
  if (!data.code) {
    return {
      success: false,
      error: "Please enter the verification code we emailed you.",
    }
  }
  try {
    await sdk.client.fetch(`/store/account/reset-password/confirm`, {
      method: "POST",
      body: data,
    })
    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      error:
        error?.message ||
        "We couldn't reset your password. Please check the code and try again.",
    }
  }
}

/**
 * Change the signed-in customer's password. Requires the current password,
 * which the backend verifies before applying the change.
 */
export async function updateCustomerPassword(data: {
  old_password: string
  new_password: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = {
      ...(await getAuthHeaders()),
    }
    await sdk.client.fetch(`/store/customers/me/password`, {
      method: "POST",
      body: data,
      headers,
    })
    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      error:
        error?.message || "We couldn't update your password. Please try again.",
    }
  }
}

// NOTE: the legacy non-OTP `signup` action was removed — account creation now
// goes exclusively through the OTP-verified flow (requestSignupOtp +
// signupWithOtp). A password-only signup here would have bypassed that policy.

export async function login(_currentState: unknown, formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  try {
    await sdk.auth
      .login("customer", "emailpass", { email, password })
      .then(async (token) => {
        await setAuthToken(token as string)
        const customerCacheTag = await getCacheTag("customers")
        revalidateTag(customerCacheTag)
      })
  } catch (error: any) {
    return error.toString()
  }

  try {
    await transferCart()
  } catch (error: any) {
    return error.toString()
  }
}

export async function loginAction(
  email: string,
  password: string
): Promise<{ error?: string }> {
  try {
    const token = await sdk.auth.login("customer", "emailpass", {
      email,
      password,
    })
    await setAuthToken(token as string)
    const customerCacheTag = await getCacheTag("customers")
    revalidateTag(customerCacheTag)
  } catch (error: any) {
    const msg: string = error?.message ?? error.toString()
    if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("credentials")) {
      return { error: "Incorrect email or password." }
    }
    return { error: "Sign in failed. Please try again." }
  }

  try {
    await transferCart()
  } catch {
    // cart transfer is non-fatal
  }

  return {}
}


export async function signout(countryCode: string) {
  await sdk.auth.logout()

  await removeAuthToken()

  const customerCacheTag = await getCacheTag("customers")
  revalidateTag(customerCacheTag)

  await removeCartId()

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)

  redirect(`/${countryCode}/account`)
}

export async function transferCart() {
  const cartId = await getCartId()

  if (!cartId) {
    return
  }

  const headers = await getAuthHeaders()

  await sdk.store.cart.transferCart(cartId, {}, headers)

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)
}

export const addCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<any> => {
  const isDefaultBilling = (currentState.isDefaultBilling as boolean) || false
  const isDefaultShipping = (currentState.isDefaultShipping as boolean) || false

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
    phone: formData.get("phone") as string,
    is_default_billing: isDefaultBilling,
    is_default_shipping: isDefaultShipping,
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .createAddress(address, {}, headers)
    .then(async ({ customer }) => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const deleteCustomerAddress = async (
  addressId: string
): Promise<void> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.customer
    .deleteAddress(addressId, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const updateCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<any> => {
  const addressId =
    (currentState.addressId as string) || (formData.get("addressId") as string)

  if (!addressId) {
    return { success: false, error: "Address ID is required" }
  }

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
  } as HttpTypes.StoreUpdateCustomerAddress

  const phone = formData.get("phone") as string

  if (phone) {
    address.phone = phone
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .updateAddress(addressId, address, {}, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}
