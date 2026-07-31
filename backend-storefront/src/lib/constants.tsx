import React from "react"
import { CreditCard } from "@medusajs/icons"

import PayPal from "@modules/common/icons/paypal"

/* Add-on products that must stay purchasable (published) but never surface in
 * customer-facing listings, search, or their own product page. */
export const HIDDEN_PRODUCT_HANDLES = ["gift-wrap", "cod-fee"]

/**
 * Categories sold final-sale: no returns, no exchanges, and their value never
 * counts toward the free-shipping threshold. Mirrors
 * `NON_RETURNABLE_CATEGORY_HANDLES` on the backend, which does the enforcing —
 * this copy only drives what the storefront tells the customer.
 */
export const FINAL_SALE_CATEGORY_HANDLES = ["coins"]

/**
 * Gift cards are withdrawn — the product and every issued card were purged, so
 * no code a shopper could type would ever be valid. The redemption field is
 * hidden rather than deleted: the backend module, endpoints and admin route are
 * all still in place, so flipping this back to true is the only step needed to
 * bring the feature back (plus reseeding the gift card product).
 */
export const GIFT_CARDS_ENABLED = false

/* Map of payment provider_id to their title and icon. Add in any payment providers you want to use. */
export const paymentInfoMap: Record<
  string,
  { title: string; icon: React.JSX.Element }
> = {
  pp_paypal_paypal: {
    title: "PayPal",
    icon: <PayPal />,
  },
  pp_system_default: {
    title: "Manual Payment",
    icon: <CreditCard />,
  },
  pp_razorpay_razorpay: {
    title: "Razorpay (UPI / Cards / Wallets)",
    icon: <CreditCard />,
  },
  pp_cod_cod: {
    title: "Cash on Delivery",
    icon: <CreditCard />,
  },
}

export const isPaypal = (providerId?: string) => {
  return providerId?.startsWith("pp_paypal")
}

export const isManual = (providerId?: string) => {
  return providerId?.startsWith("pp_system_default")
}

export const isRazorpay = (providerId?: string) => {
  return providerId?.startsWith("pp_razorpay")
}

export const isCod = (providerId?: string) => {
  return providerId?.startsWith("pp_cod")
}

// Add currencies that don't need to be divided by 100
export const noDivisionCurrencies = [
  "krw",
  "jpy",
  "vnd",
  "clp",
  "pyg",
  "xaf",
  "xof",
  "bif",
  "djf",
  "gnf",
  "kmf",
  "mga",
  "rwf",
  "xpf",
  "htg",
  "vuv",
  "xag",
  "xdr",
  "xau",
]
