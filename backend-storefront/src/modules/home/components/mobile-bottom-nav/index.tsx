"use client"

import { usePathname } from "next/navigation"
import { Store, Search, Heart, User } from "lucide-react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const NAV_ITEMS = [
  { label: "Shop", icon: Store, href: "/store" },
  { label: "Search", icon: Search, href: "/search" },
  { label: "Wishlist", icon: Heart, href: "/account/wishlist" },
  { label: "Account", icon: User, href: "/account" },
]

export default function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.08)] rounded-t-xl small:hidden">
      <div className="flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = pathname?.includes(item.href)

          return (
            <LocalizedClientLink
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                isActive
                  ? "[background:var(--color-plum)] text-white"
                  : "text-[var(--color-text-muted)]"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </LocalizedClientLink>
          )
        })}
      </div>
    </nav>
  )
}
