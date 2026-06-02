"use client"

import { ArrowRight } from "lucide-react"

import CartTotals from "@modules/common/components/cart-totals"
import DiscountCode from "@modules/checkout/components/discount-code"
import GiftCardCode from "@modules/checkout/components/gift-card-code"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

type SummaryProps = {
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[]
  }
}

function getCheckoutStep(cart: HttpTypes.StoreCart) {
  if (!cart?.shipping_address?.address_1 || !cart.email) {
    return "address"
  } else if (cart?.shipping_methods?.length === 0) {
    return "delivery"
  } else {
    return "payment"
  }
}

const Summary = ({ cart }: SummaryProps) => {
  const step = getCheckoutStep(cart)

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-lavender)] p-6 small:p-7 flex flex-col gap-6">
      <h2 className="font-wittgenstein text-[22px] font-bold text-[var(--color-plum)]">
        Order Summary
      </h2>

      <DiscountCode cart={cart} />
      <GiftCardCode cart={cart} />

      <div className="h-px w-full bg-[var(--color-border)]" />

      <CartTotals totals={cart} />

      <LocalizedClientLink
        href={"/checkout?step=" + step}
        data-testid="checkout-button"
      >
        <button className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] transition-all">
          Proceed to Checkout
          <ArrowRight size={15} />
        </button>
      </LocalizedClientLink>
    </div>
  )
}

export default Summary
