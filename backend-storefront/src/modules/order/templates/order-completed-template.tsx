import { cookies as nextCookies } from "next/headers"
import { CheckCircle2, ShoppingBag, Package } from "lucide-react"

import CartTotals from "@modules/common/components/cart-totals"
import Help from "@modules/order/components/help"
import Items from "@modules/order/components/items"
import OnboardingCta from "@modules/order/components/onboarding-cta"
import OrderDetails from "@modules/order/components/order-details"
import OrderTimeline from "@modules/order/components/order-timeline"
import { getDisplayFulfillmentStatus } from "@lib/util/order-status"
import ShippingDetails from "@modules/order/components/shipping-details"
import PaymentDetails from "@modules/order/components/payment-details"
import GuestOnboardingPrompt from "@modules/order/components/guest-onboarding-prompt"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

type OrderCompletedTemplateProps = {
  order: HttpTypes.StoreOrder
  customer?: HttpTypes.StoreCustomer | null
}

export default async function OrderCompletedTemplate({
  order,
  customer,
}: OrderCompletedTemplateProps) {
  const cookies = await nextCookies()

  const isOnboarding = cookies.get("_medusa_onboarding")?.value === "true"

  return (
    <div className="bg-[var(--color-bg-primary)] font-outfit min-h-[calc(100vh-64px)] py-10 small:py-14">
      <div className="content-container max-w-4xl flex flex-col gap-8">
        {isOnboarding && <OnboardingCta orderId={order.id} />}

        {/* Success header */}
        <div className="text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
            <CheckCircle2 size={34} className="text-green-600" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]">
            Order Confirmed
          </span>
          <h1 className="font-wittgenstein text-[28px] small:text-[40px] font-bold text-[var(--color-plum)] mt-2">
            Thank you for your order!
          </h1>
          <p className="text-[14px] small:text-[15px] text-[var(--color-text-secondary)] mt-2.5 max-w-lg">
            Your order has been placed successfully. A confirmation has been
            sent to your email — we'll let you know as soon as it ships.
          </p>
        </div>

        {/* Order detail card */}
        <div
          className="bg-white rounded-2xl border border-[var(--color-lavender)] p-6 small:p-8 flex flex-col gap-6"
          data-testid="order-complete-container"
        >
          <OrderDetails order={order} />

          <div className="border-t border-[var(--color-lavender)] pt-6">
            <OrderTimeline
              createdAt={order.created_at}
              history={
                ((order.metadata as any)?.shiprocket_history as any[]) || []
              }
              isCanceled={(order as any).status === "canceled"}
              rtoProcessedAt={
                (order.metadata as any)?.rto_processed_at || null
              }
              rtoRefundAmount={
                Number((order.metadata as any)?.rto_refund_amount) || null
              }
              currencyCode={order.currency_code}
            />
          </div>

          {!customer && <GuestOnboardingPrompt order={order} />}

          <div className="border-t border-[var(--color-lavender)] pt-6">
            <h2 className="font-wittgenstein text-[22px] font-bold text-[var(--color-plum)] mb-4">
              Order Summary
            </h2>
            <Items order={order} />
            <CartTotals totals={order} />
          </div>

          <div className="border-t border-[var(--color-lavender)] pt-6">
            <ShippingDetails order={order} />
          </div>

          <div className="border-t border-[var(--color-lavender)] pt-6">
            <PaymentDetails order={order} />
          </div>

          <div className="border-t border-[var(--color-lavender)] pt-6">
            <Help />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col xsmall:flex-row justify-center gap-3">
          {customer && (
            <LocalizedClientLink
              href="/account/orders"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full border-2 border-[var(--color-plum)] text-[var(--color-plum)] text-[12px] font-bold uppercase tracking-wider hover:bg-[var(--color-plum)] hover:text-white transition-all"
            >
              <Package size={15} />
              View My Orders
            </LocalizedClientLink>
          )}
          <LocalizedClientLink
            href="/store"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] transition-all"
          >
            <ShoppingBag size={15} />
            Continue Shopping
          </LocalizedClientLink>
        </div>
      </div>
    </div>
  )
}
