import { ShoppingBag, Gift } from "lucide-react"

import OrderCard from "../order-card"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

const OrderOverview = ({ orders }: { orders: HttpTypes.StoreOrder[] }) => {
  if (!orders?.length) {
    return (
      <div
        className="bg-white rounded-2xl border border-[var(--color-lavender)] flex flex-col items-center gap-4 py-16 px-6 text-center"
        data-testid="no-orders-container"
      >
        <div className="w-14 h-14 rounded-full bg-[var(--color-lavender)] flex items-center justify-center">
          <ShoppingBag className="w-6 h-6 text-[var(--color-plum)]" strokeWidth={1.6} />
        </div>
        <h2 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)]">
          No Orders Yet
        </h2>
        <p className="text-[14px] text-[var(--color-text-muted)] max-w-sm">
          You haven&apos;t placed any orders yet. Start exploring our
          collection and find something you love.
        </p>
        <LocalizedClientLink
          href="/store"
          className="mt-2 px-6 py-3 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold hover:brightness-105 transition-all"
          data-testid="continue-shopping-button"
        >
          Start Shopping
        </LocalizedClientLink>
      </div>
    )
  }

  return (
    <div>
      {/* Order cards */}
      <div className="space-y-5" data-testid="orders-list">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>

      {/* Promo CTA */}
      <div className="mt-12 bg-[var(--color-bg-secondary)] rounded-3xl p-10 small:p-12 text-center flex flex-col items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-[var(--color-plum)] text-white flex items-center justify-center">
          <Gift size={28} />
        </div>
        <div>
          <h2 className="font-wittgenstein text-[24px] font-semibold text-[var(--color-plum)] mb-2">
            Gifting a piece of forever?
          </h2>
          <p className="text-[14px] text-[var(--color-text-muted)] max-w-lg mx-auto leading-relaxed">
            Every Delfee piece arrives in a premium box with a certificate of
            authenticity — ready for your most precious moments.
          </p>
        </div>
        <LocalizedClientLink
          href="/store"
          className="px-8 py-3 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold shadow-lg hover:scale-105 transition-transform"
        >
          Explore Gifting Collection
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default OrderOverview
