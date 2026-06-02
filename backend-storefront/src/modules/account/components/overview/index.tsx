import Image from "next/image"
import { ShoppingBag, MapPin, ShieldCheck, ChevronRight, Star } from "lucide-react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type OverviewProps = {
  customer: HttpTypes.StoreCustomer | null
  orders: HttpTypes.StoreOrder[] | null
}

/* ─── Fulfillment status → dot colour + label ─── */
const STATUS_META: Record<string, { dot: string; label: string }> = {
  fulfilled: { dot: "bg-green-500", label: "Fulfilled" },
  delivered: { dot: "bg-green-500", label: "Delivered" },
  shipped: { dot: "bg-blue-500", label: "Shipped" },
  partially_fulfilled: { dot: "bg-amber-500", label: "Partially Fulfilled" },
  partially_shipped: { dot: "bg-amber-500", label: "Partially Shipped" },
  canceled: { dot: "bg-red-500", label: "Canceled" },
  not_fulfilled: { dot: "bg-gray-400", label: "Processing" },
}

function statusMeta(status?: string | null) {
  return (
    STATUS_META[status || "not_fulfilled"] || {
      dot: "bg-gray-400",
      label: (status || "Processing").replace(/_/g, " "),
    }
  )
}

const Overview = ({ customer, orders }: OverviewProps) => {
  const profileCompletion = getProfileCompletion(customer)
  const orderCount = orders?.length || 0
  const recentOrders = orders?.slice(0, 3) || []

  const memberSince = customer?.created_at
    ? new Date(customer.created_at).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      })
    : null

  return (
    <div className="space-y-10" data-testid="overview-page-wrapper">

      {/* ── Welcome header ──────────────────────────── */}
      <div className="flex flex-col tablet:flex-row tablet:items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--color-plum)] mb-1.5">
            Namaste,
          </p>
          <h1
            className="font-wittgenstein text-[30px] tablet:text-[40px] font-bold text-[var(--color-plum)] leading-tight"
            data-testid="welcome-message"
            data-value={customer?.first_name}
          >
            {customer?.first_name} {customer?.last_name}
          </h1>
        </div>
        {memberSince && (
          <div className="flex items-center gap-2 text-[13px] italic text-[var(--color-text-muted)]">
            <Star size={15} className="text-[var(--color-gold)] fill-[var(--color-gold)]" />
            Member since {memberSince}
          </div>
        )}
      </div>

      {/* ── Bento cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 tablet:grid-cols-3 gap-5">
        {/* Orders */}
        <div className="tablet:col-span-2 relative overflow-hidden bg-white rounded-2xl border border-[var(--color-lavender)] shadow-[0_20px_40px_rgba(93,46,70,0.06)] p-7">
          <div className="relative z-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--color-plum)] mb-2">
              Your Orders
            </p>
            <div className="flex items-baseline gap-2">
              <span className="font-wittgenstein text-[44px] font-bold text-[var(--color-plum)] leading-none">
                {orderCount}
              </span>
              <span className="text-[13px] text-[var(--color-text-muted)]">
                {orderCount === 1 ? "order placed" : "orders placed"}
              </span>
            </div>
            <LocalizedClientLink
              href="/account/orders"
              className="inline-block mt-6 px-6 py-2.5 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold hover:brightness-105 transition-all"
            >
              View All Orders
            </LocalizedClientLink>
          </div>
          <ShoppingBag
            className="absolute -right-6 -bottom-6 w-[150px] h-[150px] text-[var(--color-plum)] opacity-[0.05]"
            strokeWidth={1}
          />
        </div>

        {/* Profile completion */}
        <div className="relative overflow-hidden bg-[var(--color-plum)] rounded-2xl shadow-lg p-7 flex flex-col justify-between text-white">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/60 mb-2">
              Profile
            </p>
            <h3
              className="font-wittgenstein text-[24px] font-semibold"
              data-testid="customer-profile-completion"
              data-value={profileCompletion}
            >
              {profileCompletion}% Complete
            </h3>
          </div>
          <div className="mt-6">
            <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--color-gold)]"
                style={{ width: `${profileCompletion}%` }}
              />
            </div>
            <p className="text-[12px] mt-3 text-white/75">
              {profileCompletion === 100
                ? "Your profile is all set."
                : "Add more details to complete it."}
            </p>
          </div>
        </div>
      </div>

      {/* ── Recent orders ───────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-wittgenstein text-[22px] font-semibold text-[var(--color-plum)]">
            Recent Orders
          </h3>
          <LocalizedClientLink
            href="/account/orders"
            className="text-[13px] font-semibold text-[var(--color-plum)] hover:underline decoration-[var(--color-gold)] decoration-2 underline-offset-4"
          >
            View All Orders
          </LocalizedClientLink>
        </div>

        {recentOrders.length > 0 ? (
          <div className="space-y-3" data-testid="orders-wrapper">
            {recentOrders.map((order) => {
              const meta = statusMeta(order.fulfillment_status)
              const thumb = order.items?.[0]?.thumbnail
              return (
                <LocalizedClientLink
                  key={order.id}
                  href={`/account/orders/details/${order.id}`}
                  data-testid="order-wrapper"
                  data-value={order.id}
                  className="group flex flex-col tablet:flex-row tablet:items-center gap-5 tablet:gap-8 bg-white rounded-2xl border border-[var(--color-lavender)] p-5 hover:shadow-md transition-shadow"
                >
                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-[var(--color-bg-secondary)] shrink-0 relative">
                    <Image
                      src={thumb || "/images/fallback-no-image.png"}
                      alt={order.items?.[0]?.title || `Order ${order.display_id}`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="80px"
                    />
                  </div>

                  {/* Fields */}
                  <div className="flex-grow grid grid-cols-2 tablet:grid-cols-4 gap-4 w-full">
                    <Field label="Order #">
                      <span data-testid="order-id">#{order.display_id}</span>
                    </Field>
                    <Field label="Date">
                      {new Date(order.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Field>
                    <div>
                      <FieldLabel>Status</FieldLabel>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                        <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
                          {meta.label}
                        </span>
                      </div>
                    </div>
                    <Field label="Total">
                      <span
                        className="font-bold text-[var(--color-plum)]"
                        data-testid="order-amount"
                      >
                        {convertToLocale({
                          amount: order.total,
                          currency_code: order.currency_code,
                        })}
                      </span>
                    </Field>
                  </div>

                  {/* Chevron */}
                  <div className="hidden tablet:flex w-9 h-9 rounded-full items-center justify-center text-[var(--color-plum)] group-hover:bg-[var(--color-bg-secondary)] transition-colors shrink-0">
                    <ChevronRight size={20} />
                  </div>
                </LocalizedClientLink>
              )
            })}
          </div>
        ) : (
          <div
            className="bg-white rounded-2xl border border-[var(--color-lavender)] text-center py-12"
            data-testid="no-orders-message"
          >
            <p className="text-[14px] text-[var(--color-text-muted)] mb-3">
              You haven&apos;t placed any orders yet.
            </p>
            <LocalizedClientLink
              href="/store"
              className="text-[13px] font-semibold text-[var(--color-plum)] hover:underline underline-offset-2"
            >
              Start Shopping
            </LocalizedClientLink>
          </div>
        )}
      </div>

      {/* ── Settings fast-links ─────────────────────── */}
      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-5">
        <FastLink
          href="/account/profile"
          icon={<ShieldCheck size={22} />}
          title="Login & Security"
          desc="Update your password and personal account details."
        />
        <FastLink
          href="/account/addresses"
          icon={<MapPin size={22} />}
          title="Saved Addresses"
          desc="Manage your delivery and billing addresses."
        />
      </div>
    </div>
  )
}

/* ─── Small helpers ─────────────────────────────── */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
      {children}
    </p>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
        {children}
      </p>
    </div>
  )
}

function FastLink({
  href,
  icon,
  title,
  desc,
}: {
  href: string
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <LocalizedClientLink
      href={href}
      className="group flex items-start gap-5 p-6 rounded-2xl border border-[var(--color-lavender)] bg-white hover:border-[var(--color-gold)] transition-colors"
    >
      <div className="w-12 h-12 rounded-full bg-[var(--color-lavender)] text-[var(--color-plum)] flex items-center justify-center shrink-0 group-hover:bg-[var(--color-gold)] group-hover:text-white transition-colors">
        {icon}
      </div>
      <div>
        <h4 className="font-wittgenstein text-[18px] font-semibold text-[var(--color-plum)] mb-1">
          {title}
        </h4>
        <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">
          {desc}
        </p>
      </div>
    </LocalizedClientLink>
  )
}

const getProfileCompletion = (customer: HttpTypes.StoreCustomer | null) => {
  let count = 0
  if (!customer) return 0
  if (customer.email) count++
  if (customer.first_name && customer.last_name) count++
  if (customer.phone) count++
  if (customer.addresses?.find((addr) => addr.is_default_billing)) count++
  return (count / 4) * 100
}

export default Overview
