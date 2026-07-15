import Image from "next/image"
import {
  CheckCircle2,
  Package,
  Truck,
  PackageCheck,
  MapPin,
  CreditCard,
  ExternalLink,
  Headset,
  ChevronLeft,
} from "lucide-react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CopyButton from "@modules/order/components/copy-button"
import OrderTimeline from "@modules/order/components/order-timeline"
import ReorderButton from "@modules/account/components/reorder-button"
import RequestReturn from "@modules/returns/components/request-return"
import { convertToLocale } from "@lib/util/money"
import { getDisplayFulfillmentStatus } from "@lib/util/order-status"
import { HttpTypes } from "@medusajs/types"

type Props = {
  order: HttpTypes.StoreOrder
  returnsEnabled?: boolean
}

const STEPS = [
  { label: "Confirmed", icon: CheckCircle2 },
  { label: "Processed", icon: Package },
  { label: "Shipped", icon: Truck },
  { label: "Delivered", icon: PackageCheck },
]

const BADGE: Record<string, { label: string; cls: string }> = {
  not_fulfilled: { label: "Order Placed", cls: "bg-[var(--color-lavender)] text-[var(--color-plum)]" },
  fulfilled: { label: "Processed", cls: "bg-amber-100 text-amber-700" },
  partially_fulfilled: { label: "Processed", cls: "bg-amber-100 text-amber-700" },
  shipped: { label: "In Transit", cls: "bg-blue-100 text-blue-700" },
  partially_shipped: { label: "In Transit", cls: "bg-blue-100 text-blue-700" },
  delivered: { label: "Delivered", cls: "bg-green-100 text-green-700" },
  partially_delivered: { label: "Delivered", cls: "bg-green-100 text-green-700" },
  canceled: { label: "Canceled", cls: "bg-red-100 text-red-600" },
}

const PAY_BADGE: Record<string, { label: string; cls: string }> = {
  captured: { label: "Paid", cls: "bg-green-100 text-green-700" },
  authorized: { label: "Authorized", cls: "bg-blue-100 text-blue-700" },
  partially_captured: { label: "Partially Paid", cls: "bg-amber-100 text-amber-700" },
  awaiting: { label: "Pending", cls: "bg-amber-100 text-amber-700" },
  not_paid: { label: "Pending", cls: "bg-amber-100 text-amber-700" },
  canceled: { label: "Canceled", cls: "bg-red-100 text-red-600" },
  refunded: { label: "Refunded", cls: "bg-red-100 text-red-600" },
}

function stepIndexFor(status?: string | null) {
  switch (status) {
    case "delivered":
    case "partially_delivered":
      return 3
    case "shipped":
    case "partially_shipped":
      return 2
    case "fulfilled":
    case "partially_fulfilled":
      return 1
    default:
      return 0
  }
}

function paymentMethodLabel(providerId?: string | null) {
  const id = (providerId || "").toLowerCase()
  if (id.includes("razorpay")) return "Razorpay"
  if (id.includes("cod")) return "Cash on Delivery"
  if (id.includes("manual") || id.includes("system")) return "Manual Payment"
  if (id) return id.replace(/^pp_/, "").replace(/_/g, " ")
  return "—"
}

function fmtDate(d?: string | Date | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function fmtDateTime(d?: string | Date | null) {
  if (!d) return null
  const date = new Date(d)
  return (
    date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) +
    " • " +
    date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  )
}

export default function OrderDetailsTemplate({
  order,
  returnsEnabled = true,
}: Props) {
  const fulfillment = (order as any).fulfillments?.[0] as any | undefined
  const meta = (order.metadata as any) || {}
  const displayStatus = getDisplayFulfillmentStatus(order)
  const idx = stepIndexFor(displayStatus)
  const badge = BADGE[displayStatus] || BADGE.not_fulfilled

  const itemCount =
    order.items?.reduce((acc, i) => acc + i.quantity, 0) ?? 0
  const address = order.shipping_address

  const deliveredAt = fulfillment?.delivered_at || meta.delivered_at

  const stepDates = [
    fmtDateTime(order.created_at),
    fmtDateTime(fulfillment?.packed_at || fulfillment?.created_at),
    fmtDateTime(fulfillment?.shipped_at),
    fmtDateTime(deliveredAt),
  ]

  const estLabel = deliveredAt ? "Delivered On" : "Estimated Delivery"
  const estValue = deliveredAt
    ? fmtDate(deliveredAt)
    : fmtDate(new Date(new Date(order.created_at).getTime() + 7 * 86400000))

  const courierName = fulfillment?.data?.courier_name as string | undefined
  const trackingNumber =
    fulfillment?.labels?.[0]?.tracking_number ||
    (fulfillment?.data?.awb_code as string | undefined) ||
    (meta.awb as string | undefined)
  const trackingUrl = fulfillment?.labels?.[0]?.tracking_url as string | undefined
  const isShipped = idx >= 2 || !!trackingNumber

  const payment = (order as any).payment_collections?.[0]?.payments?.[0]
  const payBadge =
    PAY_BADGE[order.payment_status || "not_paid"] || {
      label: order.payment_status || "Pending",
      cls: "bg-gray-100 text-gray-600",
    }

  const activity = [
    {
      label: "Delivered",
      desc: "Your order has been delivered.",
      date: fulfillment?.delivered_at,
    },
    {
      label: "Shipped",
      desc: "Your order is on its way to the delivery address.",
      date: fulfillment?.shipped_at,
    },
    {
      label: "Order Packed",
      desc: "Your order has been packed and handed to the courier.",
      date: fulfillment?.packed_at || fulfillment?.created_at,
    },
    {
      label: "Order Confirmed",
      desc: "We received your order and payment.",
      date: order.created_at,
    },
  ].filter((a) => !!a.date)

  return (
    <div className="space-y-6" data-testid="order-details-page">

      {/* Back link */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <LocalizedClientLink
          href="/account/orders"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-plum)] transition-colors"
          data-testid="back-to-overview-button"
        >
          <ChevronLeft size={16} />
          Back to Orders
        </LocalizedClientLink>
        <ReorderButton orderId={order.id} variant="primary" />
      </div>

      {/* ── Order summary header + progress tracker ── */}
      <section className="bg-white rounded-2xl border border-[var(--color-lavender)] shadow-[0_20px_40px_rgba(93,46,70,0.05)] p-6 small:p-8">
        <div className="flex flex-col tablet:flex-row tablet:items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="font-wittgenstein text-[24px] small:text-[28px] font-bold text-[var(--color-plum)]">
                Order #{order.display_id}
              </h1>
              <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
            <p className="text-[13px] text-[var(--color-text-muted)]">
              Placed on {fmtDate(order.created_at)} • {itemCount}{" "}
              {itemCount === 1 ? "item" : "items"}
            </p>
          </div>
          <div className="tablet:text-right shrink-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              {estLabel}
            </p>
            <p className="font-wittgenstein text-[18px] font-semibold text-[var(--color-plum)]">
              {estValue}
            </p>
          </div>
        </div>

        {/* Progress tracker — history-driven */}
        <div className="pt-3 pb-1">
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
      </section>

      {/* Request a return — only when the feature toggle is on AND the
          order is delivered + within window (checked inside the component) */}
      {returnsEnabled && <RequestReturn order={order} />}

      {/* ── Bento: items + shipping/payment/courier/help ── */}
      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-6">

        {/* Items in order */}
        <div className="bg-white rounded-2xl border border-[var(--color-lavender)] shadow-sm p-6">
          <h2 className="font-wittgenstein text-[18px] font-semibold text-[var(--color-plum)] mb-5">
            Items in Order
          </h2>
          <div className="space-y-4">
            {order.items?.map((item) => (
              <div key={item.id} className="flex gap-4">
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] shrink-0">
                  <Image
                    src={item.thumbnail || "/images/fallback-no-image.png"}
                    alt={item.product_title || item.title || "Item"}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[var(--color-text-primary)] leading-tight">
                    {item.product_title || item.title}
                  </p>
                  {item.variant_title && (
                    <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
                      {item.variant_title} • Qty {item.quantity}
                    </p>
                  )}
                  <p className="text-[13px] font-bold text-[var(--color-plum)] mt-1">
                    {convertToLocale({
                      amount: item.total,
                      currency_code: order.currency_code,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-6 pt-5 border-t border-[var(--color-lavender)] space-y-2">
            <div className="flex justify-between text-[13px] text-[var(--color-text-muted)]">
              <span>Subtotal</span>
              <span>
                {convertToLocale({
                  amount: order.item_subtotal ?? order.subtotal,
                  currency_code: order.currency_code,
                })}
              </span>
            </div>
            <div className="flex justify-between text-[13px] text-[var(--color-text-muted)]">
              <span>Shipping</span>
              <span>
                {order.shipping_total
                  ? convertToLocale({
                      amount: order.shipping_total,
                      currency_code: order.currency_code,
                    })
                  : "Free"}
              </span>
            </div>
            {!!order.discount_total && (
              <div className="flex justify-between text-[13px] text-green-700 font-semibold">
                <span>Discount</span>
                <span>
                  {`− ${convertToLocale({
                    amount: order.discount_total,
                    currency_code: order.currency_code,
                  })}`}
                </span>
              </div>
            )}
            <div className="flex justify-between text-[15px] font-bold text-[var(--color-plum)] pt-1.5">
              <span>Total</span>
              <span>
                {convertToLocale({
                  amount: order.total,
                  currency_code: order.currency_code,
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Shipping + payment + courier + help */}
        <div className="space-y-6">

          {/* Shipping address */}
          <div className="bg-white rounded-2xl border border-[var(--color-lavender)] shadow-sm p-6">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={16} className="text-[var(--color-plum)]" />
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-plum)]">
                Shipping Address
              </h3>
            </div>
            {address ? (
              <div className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">
                <p className="font-semibold text-[var(--color-text-primary)]">
                  {address.first_name} {address.last_name}
                </p>
                {address.address_1 && <p>{address.address_1}</p>}
                {address.address_2 && <p>{address.address_2}</p>}
                <p>
                  {[address.city, address.province, address.postal_code]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {address.country_code && (
                  <p className="uppercase">{address.country_code}</p>
                )}
                {address.phone && <p className="mt-1.5">Phone: {address.phone}</p>}
              </div>
            ) : (
              <p className="text-[13px] text-[var(--color-text-muted)]">
                No shipping address on file.
              </p>
            )}
          </div>

          {/* Payment method */}
          <div className="bg-white rounded-2xl border border-[var(--color-lavender)] shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-[var(--color-plum)]" />
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-plum)]">
                  Payment Method
                </h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${payBadge.cls}`}>
                {payBadge.label}
              </span>
            </div>
            <p className="text-[14px] font-semibold text-[var(--color-text-primary)] capitalize">
              {paymentMethodLabel(payment?.provider_id)}
            </p>
            <p className="text-[13px] text-[var(--color-text-muted)] mt-0.5">
              {convertToLocale({
                amount: order.total,
                currency_code: order.currency_code,
              })}{" "}
              total
            </p>
          </div>

          {/* Courier info */}
          <div className="bg-white rounded-2xl border border-[var(--color-lavender)] shadow-sm p-6 border-l-4 border-l-[var(--color-gold)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-[var(--color-gold)]" />
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-plum)]">
                  Courier Info
                </h3>
              </div>
              {courierName && (
                <span className="bg-[var(--color-bg-secondary)] text-[var(--color-plum)] px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                  {courierName}
                </span>
              )}
            </div>
            {isShipped && trackingNumber ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Tracking ID
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[14px] font-bold text-[var(--color-text-primary)]">
                      {trackingNumber}
                    </p>
                    <CopyButton value={String(trackingNumber)} />
                  </div>
                </div>
                {trackingUrl && (
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-[var(--color-plum)] hover:underline"
                  >
                    Track on partner site
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-[var(--color-text-muted)]">
                Your order hasn&apos;t shipped yet. Tracking details will appear
                here once it&apos;s dispatched.
              </p>
            )}
          </div>

          {/* Need help */}
          <div className="bg-[var(--color-plum)] rounded-2xl shadow-sm p-6 flex items-center justify-between gap-4">
            <div>
              <p className="font-wittgenstein text-[18px] font-semibold text-white">
                Need Help?
              </p>
              <p className="text-[12px] text-white/70">
                Our concierge is here for you.
              </p>
            </div>
            <LocalizedClientLink
              href="/contact"
              className="shrink-0 flex items-center gap-1.5 bg-[var(--color-gold)] text-[var(--color-plum-deep)] px-5 py-2.5 rounded-full text-[12px] font-bold hover:scale-105 transition-transform"
            >
              <Headset size={15} />
              Contact
            </LocalizedClientLink>
          </div>
        </div>
      </div>

      {/* ── Detailed activity ── */}
      <section className="bg-white rounded-2xl border border-[var(--color-lavender)] shadow-sm p-6 small:p-8">
        <h2 className="font-wittgenstein text-[18px] font-semibold text-[var(--color-plum)] mb-6">
          Detailed Activity
        </h2>
        <div className="relative space-y-7 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[var(--color-lavender)]">
          {activity.map((a, i) => (
            <div key={a.label} className="relative pl-9">
              <div
                className={`absolute left-0 top-0.5 w-6 h-6 rounded-full border-4 border-white ${
                  i === 0 ? "bg-[var(--color-gold)]" : "bg-[var(--color-lavender)]"
                }`}
              />
              <div className="flex flex-col tablet:flex-row tablet:justify-between gap-0.5">
                <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                  {a.label}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  {fmtDateTime(a.date)}
                </p>
              </div>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
                {a.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
