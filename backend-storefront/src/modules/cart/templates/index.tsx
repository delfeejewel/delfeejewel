import { HttpTypes } from "@medusajs/types"

import ItemsTemplate from "./items"
import Summary from "./summary"
import EmptyCartMessage from "../components/empty-cart-message"
import SignInPrompt from "../components/sign-in-prompt"
import GiftWrapToggle from "../components/gift-wrap-toggle"

const GIFT_WRAP_HANDLE = "gift-wrap"

const CartTemplate = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const isEmpty = !cart?.items?.length

  return (
    <div className="font-outfit bg-[var(--color-bg-primary)] py-8 small:py-12">
      <div className="content-container" data-testid="cart-container">
        {isEmpty ? (
          <EmptyCartMessage regionId={cart?.region_id || undefined} />
        ) : (
          <>
            {/* Page heading */}
            <header className="mb-6 small:mb-8">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]">
                Your bag
              </span>
              <h1 className="font-wittgenstein text-[28px] small:text-[36px] font-bold text-[var(--color-plum)] mt-1 leading-tight">
                Almost yours
              </h1>
            </header>

            <div className="grid grid-cols-1 small:grid-cols-[1fr_400px] gap-6 small:gap-8 items-start">
              <div className="flex flex-col gap-5">
                {!customer && <SignInPrompt />}
                <ItemsTemplate cart={cart} />
                <GiftWrapToggle
                  initial={
                    !!(cart.metadata as any)?.gift_wrap ||
                    (cart.items?.some(
                      (it: any) =>
                        it.product_handle === GIFT_WRAP_HANDLE ||
                        it.variant?.product?.handle === GIFT_WRAP_HANDLE
                    ) ??
                      false)
                  }
                  currencyCode={cart.currency_code || "inr"}
                />
              </div>
              <div className="relative">
                <div className="flex flex-col gap-y-6 sticky top-24">
                  {cart && cart.region && <Summary cart={cart as any} />}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default CartTemplate
