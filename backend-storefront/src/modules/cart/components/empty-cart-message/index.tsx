import {
  ShoppingBag,
  Heart,
  Home,
  Sparkles,
  Truck,
  PackageSearch,
} from "lucide-react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import RecentlyViewed from "@modules/store/components/recently-viewed"

const QUICK_LINKS = [
  { icon: Home, label: "Home", href: "/" },
  { icon: PackageSearch, label: "Browse all", href: "/store" },
  { icon: Heart, label: "Wishlist", href: "/account/wishlist" },
  { icon: Truck, label: "Track order", href: "/track-order" },
]

export default function EmptyCartMessage({
  regionId,
}: {
  regionId?: string
}) {
  return (
    <div className="font-outfit" data-testid="empty-cart-message">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl [background:linear-gradient(135deg,#faf9f7_0%,#f4f3f1_45%,#e6e2ee_100%)]">
        <div className="absolute -top-24 -right-16 w-96 h-96 rounded-full bg-[var(--color-gold)]/[0.10] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 -left-20 w-96 h-96 rounded-full bg-[var(--color-plum)]/[0.08] blur-3xl pointer-events-none" />

        <div className="relative z-10 py-16 small:py-24 px-6 small:px-10">
          <div className="max-w-xl mx-auto text-center flex flex-col items-center">
            {/* Icon */}
            <div className="relative">
              <div className="w-20 h-20 small:w-24 small:h-24 rounded-full bg-[var(--color-lavender)] flex items-center justify-center border border-[var(--color-plum-light)]">
                <ShoppingBag
                  size={36}
                  strokeWidth={1.4}
                  className="text-[var(--color-plum)]"
                />
              </div>
              <Sparkles
                size={18}
                className="absolute -top-1 -right-1 text-[var(--color-gold)]"
                strokeWidth={1.8}
              />
            </div>

            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)] mt-6">
              Your cart
            </span>
            <h1 className="font-wittgenstein text-[28px] small:text-[38px] font-bold text-[var(--color-plum)] mt-2 leading-tight">
              Your cart is feeling light
            </h1>
            <p className="text-[14px] small:text-[15px] text-[var(--color-text-secondary)] mt-3 max-w-md">
              Nothing here yet. Browse the store, save favourites to your
              wishlist, and they&apos;ll be waiting whenever you&apos;re ready.
            </p>

            {/* CTAs */}
            <div className="flex flex-col xsmall:flex-row items-center gap-3 mt-8">
              <LocalizedClientLink
                href="/store"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] transition-all"
              >
                <ShoppingBag size={15} />
                Continue shopping
              </LocalizedClientLink>
              <LocalizedClientLink
                href="/account/wishlist"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full border-2 border-[var(--color-plum)] text-[var(--color-plum)] text-[12px] font-bold uppercase tracking-wider hover:bg-[var(--color-plum)] hover:text-white transition-all"
              >
                <Heart size={15} />
                View wishlist
              </LocalizedClientLink>
            </div>
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="py-10 small:py-12">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-5">
          Or jump to
        </p>
        <div className="grid grid-cols-2 medium:grid-cols-4 gap-3 small:gap-4 max-w-3xl mx-auto">
          {QUICK_LINKS.map((l) => {
            const Icon = l.icon
            return (
              <LocalizedClientLink
                key={l.label}
                href={l.href}
                className="flex flex-col items-center gap-2.5 rounded-2xl bg-white border border-[var(--color-lavender)] p-5 hover:border-[var(--color-gold)]/60 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="w-11 h-11 rounded-xl bg-[var(--color-lavender)] flex items-center justify-center">
                  <Icon size={18} className="text-[var(--color-plum)]" strokeWidth={1.6} />
                </div>
                <span className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">
                  {l.label}
                </span>
              </LocalizedClientLink>
            )
          })}
        </div>
      </section>

      {/* Recently viewed — hidden when the customer has no history */}
      {regionId && (
        <div className="-mx-4 small:-mx-0">
          <RecentlyViewed regionId={regionId} />
        </div>
      )}
    </div>
  )
}
