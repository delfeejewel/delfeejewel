import { Metadata } from "next"
import { Home, ShoppingBag, LifeBuoy, Heart } from "lucide-react"

import { BRAND } from "@lib/constants.brand"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export const metadata: Metadata = {
  title: `Page Not Found | ${BRAND.name}`,
  description: "The page you're looking for could not be found.",
  robots: { index: false, follow: true },
}

const LINKS = [
  { icon: ShoppingBag, label: "Shop All", href: "/store" },
  { icon: Heart, label: "Wishlist", href: "/account/wishlist" },
  { icon: LifeBuoy, label: "Help / FAQ", href: "/faq" },
  { icon: Home, label: "Home", href: "/" },
]

export default function NotFound() {
  return (
    <div className="bg-[var(--color-bg-primary)] font-outfit">
      <section className="relative overflow-hidden [background:linear-gradient(135deg,#faf9f7_0%,#f4f3f1_45%,#e6e2ee_100%)]">
        <div className="absolute -top-24 -right-16 w-96 h-96 rounded-full bg-[var(--color-gold)]/[0.08] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 -left-20 w-96 h-96 rounded-full bg-[var(--color-plum)]/[0.07] blur-3xl pointer-events-none" />

        <div className="page-container relative z-10 py-20 small:py-28">
          <div className="max-w-xl mx-auto text-center flex flex-col items-center">
            <p className="font-wittgenstein text-[88px] small:text-[128px] font-bold leading-none text-gradient-gold">
              404
            </p>
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)] mt-2">
              Page Not Found
            </span>
            <h1 className="font-wittgenstein text-[28px] small:text-[38px] font-bold text-[var(--color-plum)] mt-3">
              This page has slipped away
            </h1>
            <p className="text-[14px] small:text-[15px] text-[var(--color-text-secondary)] mt-3 max-w-md">
              The page you're looking for may have been moved, renamed, or no
              longer exists. Let's get you back to something beautiful.
            </p>

            <div className="flex flex-col xsmall:flex-row items-center gap-3 mt-8">
              <LocalizedClientLink
                href="/"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] transition-all"
              >
                <Home size={15} />
                Back to Home
              </LocalizedClientLink>
              <LocalizedClientLink
                href="/store"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full border-2 border-[var(--color-plum)] text-[var(--color-plum)] text-[12px] font-bold uppercase tracking-wider hover:bg-[var(--color-plum)] hover:text-white transition-all"
              >
                <ShoppingBag size={15} />
                Browse the Store
              </LocalizedClientLink>
            </div>
          </div>
        </div>
      </section>

      {/* Helpful links */}
      <section className="page-container py-12 small:py-16">
        <p className="text-center text-[12px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-6">
          Or jump to
        </p>
        <div className="grid grid-cols-2 medium:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {LINKS.map((l) => {
            const Icon = l.icon
            return (
              <LocalizedClientLink
                key={l.label}
                href={l.href}
                className="flex flex-col items-center gap-2.5 rounded-2xl bg-white border border-[var(--color-lavender)] p-6 hover:border-[var(--color-gold)]/50 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-[var(--color-lavender)] flex items-center justify-center">
                  <Icon size={19} className="text-[var(--color-plum)]" />
                </div>
                <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                  {l.label}
                </span>
              </LocalizedClientLink>
            )
          })}
        </div>
      </section>
    </div>
  )
}
