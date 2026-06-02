"use client"

import { clx } from "@medusajs/ui"
import { useSearchParams } from "next/navigation"

import PaymentButton from "../payment-button"
import { BRAND } from "@lib/constants.brand"

const Review = ({ cart }: { cart: any }) => {
  const searchParams = useSearchParams()
  const isOpen = searchParams.get("step") === "review"

  const paidByGiftcard =
    cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0

  const previousStepsCompleted =
    cart.shipping_address &&
    cart.shipping_methods.length > 0 &&
    (cart.payment_collection || paidByGiftcard)

  return (
    <div
      className={clx(
        "bg-white rounded-2xl border border-[var(--color-lavender)] p-5 small:p-7 transition-opacity",
        { "opacity-50": !isOpen }
      )}
    >
      <div className="flex flex-col mb-5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]">
          Step 4
        </span>
        <h2 className="font-wittgenstein text-[22px] small:text-[24px] font-bold text-[var(--color-plum)] mt-0.5">
          Review &amp; place order
        </h2>
      </div>

      {isOpen && previousStepsCompleted && (
        <>
          <p className="text-[12.5px] text-[var(--color-text-secondary)] leading-relaxed mb-5">
            By clicking the Place Order button, you confirm that you have read,
            understand, and accept our Terms of Use, Terms of Sale and Returns
            Policy, and acknowledge that you have read {BRAND.name}&apos;s
            Privacy Policy.
          </p>
          <PaymentButton cart={cart} data-testid="submit-order-button" />
        </>
      )}
    </div>
  )
}

export default Review
