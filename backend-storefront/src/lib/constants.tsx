import React from "react"
import { CreditCard } from "@medusajs/icons"

import PayPal from "@modules/common/icons/paypal"

/* Add-on products that must stay purchasable (published) but never surface in
 * customer-facing listings, search, or their own product page. */
export const HIDDEN_PRODUCT_HANDLES = ["gift-wrap"]

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
