"use client"

import { useParams, usePathname } from "next/navigation"
import { LayoutDashboard, User, ShoppingBag, Heart, Star, Undo2, MapPin, LogOut } from "lucide-react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { signout } from "@lib/data/customer"

const navLinks = [
  { href: "/account", label: "Overview", icon: LayoutDashboard, testId: "overview-link" },
  { href: "/account/profile", label: "Profile", icon: User, testId: "profile-link" },
  { href: "/account/orders", label: "Orders", icon: ShoppingBag, testId: "orders-link" },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart, testId: "wishlist-link" },
  { href: "/account/reviews", label: "Reviews", icon: Star, testId: "reviews-link" },
  { href: "/account/returns", label: "Returns", icon: Undo2, testId: "returns-link" },
  { href: "/account/addresses", label: "Addresses", icon: MapPin, testId: "addresses-link" },
]

const AccountNav = ({
  customer,
  returnsEnabled = true,
}: {
  customer: HttpTypes.StoreCustomer | null
  returnsEnabled?: boolean
}) => {
  const route = usePathname()
  const { countryCode } = useParams() as { countryCode: string }
  const visibleLinks = navLinks.filter(
    (link) => returnsEnabled || link.href !== "/account/returns"
  )

  const handleLogout = async () => {
    await signout(countryCode)
  }

  const isActive = (href: string) => {
    const current = route?.split(countryCode)[1] || ""
    if (href === "/account") return current === "/account"
    return current.startsWith(href)
  }

  return (
    <div>
      {/* ── Desktop sidebar ───────────────────────── */}
      <div
        className="hidden small:block sticky top-[120px]"
        data-testid="account-nav"
      >
        <h2 className="font-wittgenstein text-[22px] font-semibold text-[var(--color-plum)] mb-7">
          My Account
        </h2>

        <nav className="flex flex-col">
          {visibleLinks.map((link) => {
            const active = isActive(link.href)
            const Icon = link.icon
            return (
              <LocalizedClientLink
                key={link.href}
                href={link.href}
                data-testid={link.testId}
                className={`relative flex items-center gap-3 pl-4 py-2.5 text-[14px] transition-colors duration-200 ${
                  active
                    ? "text-[var(--color-plum)] font-semibold"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-plum)]"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r bg-[var(--color-gold)]" />
                )}
                <Icon size={19} strokeWidth={active ? 2.4 : 2} />
                <span>{link.label}</span>
              </LocalizedClientLink>
            )
          })}
        </nav>

        <div className="mt-7 pt-7 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 pl-4 text-[14px] text-red-500 hover:opacity-70 transition-opacity"
            data-testid="logout-button"
          >
            <LogOut size={19} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* ── Mobile — horizontal scroll nav ────────── */}
      <div className="small:hidden -mx-6 px-6 mb-6" data-testid="mobile-account-nav">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {visibleLinks.map((link) => {
            const active = isActive(link.href)
            const Icon = link.icon
            return (
              <LocalizedClientLink
                key={link.href}
                href={link.href}
                data-testid={link.testId}
                className={`shrink-0 flex items-center gap-2 px-4 h-10 rounded-full text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-[var(--color-plum)] text-white"
                    : "bg-white border border-[var(--color-lavender)] text-[var(--color-text-secondary)]"
                }`}
              >
                <Icon size={15} />
                <span>{link.label}</span>
              </LocalizedClientLink>
            )
          })}
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 flex items-center gap-2 px-4 h-10 rounded-full text-[13px] font-medium bg-white border border-red-200 text-red-500"
            data-testid="logout-button"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default AccountNav
