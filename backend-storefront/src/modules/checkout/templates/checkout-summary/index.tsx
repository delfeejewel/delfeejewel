import { Tag } from "lucide-react"

import ItemsPreviewTemplate from "@modules/cart/templates/preview"
import CartTotals from "@modules/common/components/cart-totals"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const CheckoutSummary = ({ cart }: { cart: any }) => {
  const promotions = (cart?.promotions || []).filter((p: any) => p?.code)

  return (
    <div className="sticky top-40 flex flex-col-reverse small:flex-col gap-y-6 py-8 small:py-0">
      <div className="bg-white rounded-2xl border border-[var(--color-lavender)] p-6 flex flex-col gap-5">
        <h2 className="font-wittgenstein text-[20px] font-bold text-[var(--color-plum)]">
          In Your Cart
        </h2>

        {promotions.length > 0 && (
          <div className="flex flex-col gap-2">
            <div
              className="flex flex-wrap gap-2"
              data-testid="checkout-promo-codes"
            >
              {promotions.map((p: any) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-lavender)] text-[var(--color-plum)] text-[11.5px] font-semibold"
                >
                  <Tag size={11} />
                  {p.code}
                </span>
              ))}
            </div>
            <LocalizedClientLink
              href="/cart"
              className="text-[11.5px] text-[var(--color-plum)] hover:underline self-start"
            >
              Edit in cart
            </LocalizedClientLink>
          </div>
        )}

        <div className="h-px w-full bg-[var(--color-border)]" />
        <CartTotals totals={cart} />
        <div className="h-px w-full bg-[var(--color-border)]" />
        <ItemsPreviewTemplate cart={cart} />
      </div>
    </div>
  )
}

export default CheckoutSummary
