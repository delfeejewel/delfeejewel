import ItemsPreviewTemplate from "@modules/cart/templates/preview"
import CartTotals from "@modules/common/components/cart-totals"
import DiscountCode from "@modules/checkout/components/discount-code"

const CheckoutSummary = ({ cart }: { cart: any }) => {
  return (
    <div className="sticky top-40 flex flex-col-reverse small:flex-col gap-y-6 py-8 small:py-0">
      <div className="bg-white rounded-2xl border border-[var(--color-lavender)] p-6 flex flex-col gap-5">
        <h2 className="font-wittgenstein text-[20px] font-bold text-[var(--color-plum)]">
          In Your Cart
        </h2>

        <DiscountCode cart={cart} />

        <div className="h-px w-full bg-[var(--color-border)]" />
        <CartTotals totals={cart} />
        <div className="h-px w-full bg-[var(--color-border)]" />
        <ItemsPreviewTemplate cart={cart} />
      </div>
    </div>
  )
}

export default CheckoutSummary
