"use client"

import { clx } from "@medusajs/ui"
import { useSearchParams } from "next/navigation"
import { useState } from "react"

import PaymentButton from "../payment-button"
import { BRAND } from "@lib/constants.brand"

const Review = ({ cart }: { cart: any }) => {
  const searchParams = useSearchParams()
  const isOpen = searchParams.get("step") === "review"
  const [agreed, setAgreed] = useState(false)

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
          Step 3
        </span>
        <h2 className="font-wittgenstein text-[22px] small:text-[24px] font-bold text-[var(--color-plum)] mt-0.5">
          Review &amp; place order
        </h2>
      </div>

      {isOpen && previousStepsCompleted && (
        <>
          <label className="flex items-start gap-3 mb-5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              data-testid="terms-agree-checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-[var(--color-border)] text-[var(--color-plum)] accent-[var(--color-plum)] focus:ring-[var(--color-plum)]/30"
            />
            <span className="text-[12.5px] text-[var(--color-text-secondary)] leading-relaxed">
              I have read and accept the Terms of Use, Terms of Sale and Returns
              Policy, and acknowledge that I have read {BRAND.name}&apos;s
              Privacy Policy.
            </span>
          </label>
          {agreed ? (
            <PaymentButton cart={cart} data-testid="submit-order-button" />
          ) : (
            <p className="text-[12px] text-[var(--color-text-muted)] italic">
              Please accept the terms above to place your order.
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default Review
