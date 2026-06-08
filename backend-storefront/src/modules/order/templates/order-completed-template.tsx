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
import GuestTrackPrompt from "@modules/order/components/guest-track-prompt"
import InvoiceButton from "@modules/order/components/invoice-button"
import ThankYouDecor from "@modules/order/components/thank-you-decor"
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
    <div className="relative overflow-hidden bg-[var(--color-bg-primary)] font-outfit min-h-[calc(100vh-64px)] py-8 small:py-14">
      <ThankYouDecor />
      <div className="relative z-10 content-container flex flex-col gap-5 small:gap-8">
        {isOnboarding && <OnboardingCta orderId={order.id} />}

        {/* Success header */}
        <div className="text-center flex flex-col items-center">
          <div className="w-14 h-14 small:w-16 small:h-16 rounded-full bg-green-50 flex items-center justify-center mb-3 small:mb-4">
            <CheckCircle2 className="text-green-600 w-7 h-7 small:w-[34px] small:h-[34px]" />
          </div>
          <span className="text-[10px] small:text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]">
            Order Confirmed
          </span>
          <h1 className="font-wittgenstein text-[24px] xsmall:text-[28px] small:text-[40px] font-bold text-[var(--color-plum)] mt-1.5 small:mt-2">
            Thank you for your order!
          </h1>
          <p className="text-[13px] small:text-[15px] text-[var(--color-text-secondary)] mt-2 max-w-lg px-2">
            Your order has been placed successfully. A confirmation has been
            sent to your email — we'll let you know as soon as it ships.
          </p>
        </div>

        {/* Guest order tracking — no account required */}
        {!customer && <GuestTrackPrompt order={order} />}

        {/* Two-column body: details on the left, summary + actions on the right */}
        <div
          className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 small:gap-6 items-start"
          data-testid="order-complete-container"
        >
          {/* Main column */}
          <div className="flex flex-col gap-5 small:gap-6 min-w-0">
            {/* Order info + timeline */}
            <div className="bg-white rounded-2xl border border-[var(--color-lavender)] p-5 small:p-8 flex flex-col gap-5 small:gap-6">
              <OrderDetails order={order} />
              <div className="border-t border-[var(--color-lavender)] pt-5 small:pt-6">
                <OrderTimeline
                  createdAt={order.created_at as string}
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
            </div>

            {/* Items */}
            <div className="bg-white rounded-2xl border border-[var(--color-lavender)] p-5 small:p-8">
              <h2 className="font-wittgenstein text-[18px] small:text-[22px] font-bold text-[var(--color-plum)] mb-3 small:mb-4">
                Items in your order
              </h2>
              <Items order={order} />
            </div>

            {/* Delivery + payment (stacked so each has full width) */}
            <div className="bg-white rounded-2xl border border-[var(--color-lavender)] p-5 small:p-8 flex flex-col gap-5 small:gap-6">
              <ShippingDetails order={order} />
              <div className="border-t border-[var(--color-lavender)] pt-5 small:pt-6">
                <PaymentDetails order={order} />
              </div>
            </div>
          </div>

          {/* Sidebar — totals + actions (sticky) */}
          <aside className="lg:sticky lg:top-6">
            <div className="bg-white rounded-2xl border border-[var(--color-lavender)] p-5 small:p-6 flex flex-col gap-5">
              <h2 className="font-wittgenstein text-[18px] small:text-[20px] font-bold text-[var(--color-plum)]">
                Order Summary
              </h2>
              <CartTotals totals={order} />
              <div className="flex flex-col gap-3 pt-1">
                <LocalizedClientLink
                  href="/store"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] transition-all text-center"
                >
                  <ShoppingBag size={15} className="shrink-0" />
                  Continue Shopping
                </LocalizedClientLink>
                <InvoiceButton order={order} className="w-full !px-6" />
                {customer && (
                  <LocalizedClientLink
                    href="/account/orders"
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border-2 border-[var(--color-plum)] text-[var(--color-plum)] text-[12px] font-bold uppercase tracking-wider hover:bg-[var(--color-plum)] hover:text-white transition-all text-center"
                  >
                    <Package size={15} className="shrink-0" />
                    View My Orders
                  </LocalizedClientLink>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Help — full width */}
        <div className="bg-white rounded-2xl border border-[var(--color-lavender)] p-5 small:p-8">
          <Help />
        </div>
      </div>
    </div>
  )
}
