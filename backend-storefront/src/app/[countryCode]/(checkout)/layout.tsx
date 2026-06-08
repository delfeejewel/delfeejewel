import Image from "next/image"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ChevronDown from "@modules/common/icons/chevron-down"
import { BRAND } from "@lib/constants.brand"

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-full bg-white relative small:min-h-screen">
      <header className="h-14 small:h-16 bg-white border-b border-[var(--color-lavender)]">
        <nav className="flex h-full items-center content-container justify-between">
          <LocalizedClientLink
            href="/cart"
            className="flex items-center gap-x-1.5 flex-1 basis-0 text-[var(--color-text-secondary)] hover:text-[var(--color-plum)] transition-colors"
            data-testid="back-to-cart-link"
          >
            <ChevronDown className="rotate-90" size={16} />
            <span className="mt-px hidden small:block text-[13px] font-medium">
              Back to shopping cart
            </span>
            <span className="mt-px block small:hidden text-[13px] font-medium">
              Back
            </span>
          </LocalizedClientLink>

          <LocalizedClientLink
            href="/"
            className="block shrink-0"
            data-testid="store-link"
          >
            <Image
              src="/images/logo-dark.png"
              alt={BRAND.name}
              width={120}
              height={40}
              className="h-8 small:h-10 w-auto object-contain"
              priority
            />
          </LocalizedClientLink>

          <div className="flex-1 basis-0 flex justify-end">
            <span className="hidden small:flex items-center gap-x-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Secure Checkout
            </span>
          </div>
        </nav>
      </header>
      <div className="relative" data-testid="checkout-container">
        {children}
      </div>
    </div>
  )
}
