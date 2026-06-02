import Image from "next/image"
import { CheckCircle2, Truck, Clock, XCircle, Package, Download } from "lucide-react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ReorderButton from "@modules/account/components/reorder-button"
import { convertToLocale } from "@lib/util/money"
import { getDisplayFulfillmentStatus } from "@lib/util/order-status"
import { HttpTypes } from "@medusajs/types"

type OrderCardProps = {
  order: HttpTypes.StoreOrder
}

const STATUS = {
  delivered: { label: "Delivered", icon: CheckCircle2, cls: "bg-green-100 text-green-700" },
  fulfilled: { label: "Fulfilled", icon: CheckCircle2, cls: "bg-green-100 text-green-700" },
  shipped: { label: "Shipped", icon: Truck, cls: "bg-blue-100 text-blue-700" },
  partially_shipped: { label: "Partially Shipped", icon: Truck, cls: "bg-blue-100 text-blue-700" },
  partially_fulfilled: { label: "Partially Fulfilled", icon: Package, cls: "bg-amber-100 text-amber-700" },
  canceled: { label: "Canceled", icon: XCircle, cls: "bg-red-100 text-red-600" },
  not_fulfilled: {
    label: "Processing",
    icon: Clock,
    cls: "bg-[var(--color-lavender)] text-[var(--color-plum)]",
  },
}

function statusMeta(status?: string | null) {
  return STATUS[status as keyof typeof STATUS] || STATUS.not_fulfilled
}

const OrderCard = ({ order }: OrderCardProps) => {
  const meta = statusMeta(getDisplayFulfillmentStatus(order))
  const StatusIcon = meta.icon
  const firstItem = order.items?.[0]
  const itemCount =
    order.items?.reduce((acc, i) => acc + i.quantity, 0) ?? 0

  return (
    <article
      className="bg-white rounded-2xl border border-[var(--color-lavender)] shadow-[0_20px_40px_rgba(93,46,70,0.04)] hover:shadow-[0_25px_50px_rgba(93,46,70,0.08)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
      data-testid="order-card"
    >
      <div className="p-6 small:p-8">

        {/* Top row — order meta + status */}
        <div className="flex flex-wrap justify-between items-start gap-4 mb-7">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-plum)]">
              Order #<span data-testid="order-display-id">{order.display_id}</span>
            </span>
            <span
              className="text-[13px] text-[var(--color-text-muted)]"
              data-testid="order-created-at"
            >
              Placed on{" "}
              {new Date(order.created_at).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <div
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full ${meta.cls}`}
          >
            <StatusIcon size={15} />
            <span className="text-[11px] font-bold uppercase tracking-widest">
              {meta.label}
            </span>
          </div>
        </div>

        {/* Middle — thumbnail | product | total */}
        <div className="grid grid-cols-1 tablet:grid-cols-12 gap-5 tablet:gap-8 items-center mb-7">
          {/* Thumbnail */}
          <div className="tablet:col-span-2">
            <div className="relative w-24 tablet:w-full aspect-square rounded-xl overflow-hidden bg-[var(--color-bg-secondary)]">
              <Image
                src={firstItem?.thumbnail || "/images/fallback-no-image.png"}
                alt={firstItem?.title || `Order ${order.display_id}`}
                fill
                className="object-cover"
                sizes="120px"
              />
            </div>
          </div>

          {/* Product info */}
          <div className="tablet:col-span-6">
            <h3 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-text-primary)] mb-1">
              {firstItem?.title || "Order items"}
            </h3>
            <p className="text-[13px] text-[var(--color-text-muted)]">
              {itemCount} {itemCount === 1 ? "item" : "items"}
              {order.items && order.items.length > 1
                ? ` across ${order.items.length} products`
                : ""}
            </p>
          </div>

          {/* Order total */}
          <div className="tablet:col-span-4 flex flex-col tablet:items-end gap-0.5">
            <span className="text-[12px] text-[var(--color-text-muted)]">
              Order Total
            </span>
            <span
              className="font-wittgenstein text-[22px] font-bold text-[var(--color-plum)]"
              data-testid="order-amount"
            >
              {convertToLocale({
                amount: order.total,
                currency_code: order.currency_code,
              })}
            </span>
          </div>
        </div>

        {/* Bottom row — actions */}
        <div className="flex flex-wrap items-center gap-3 pt-5 border-t border-[var(--color-lavender)]">
          <LocalizedClientLink
            href={`/account/orders/details/${order.id}`}
            className="px-6 py-2.5 rounded-xl bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold hover:brightness-105 active:scale-95 transition-all"
            data-testid="order-details-link"
          >
            View Details
          </LocalizedClientLink>
          <ReorderButton orderId={order.id} variant="ghost" />
          <a
            href={`/api/orders/${order.id}/invoice`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-2 text-[13px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-plum)] transition-colors"
          >
            <Download size={16} />
            Invoice
          </a>
        </div>
      </div>
    </article>
  )
}

export default OrderCard
