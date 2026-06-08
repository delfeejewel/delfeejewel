import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HelpCircle, MessageCircle, RefreshCcw, Truck } from "lucide-react"
import React from "react"

const links = [
  {
    href: "/contact",
    label: "Contact Us",
    desc: "Questions about your order",
    Icon: MessageCircle,
  },
  {
    href: "/returns-and-exchange",
    label: "Returns & Exchanges",
    desc: "Start a return or exchange",
    Icon: RefreshCcw,
  },
  {
    href: "/shipping-policy",
    label: "Shipping & Delivery",
    desc: "Tracking and timelines",
    Icon: Truck,
  },
  {
    href: "/faq",
    label: "FAQ",
    desc: "Common questions answered",
    Icon: HelpCircle,
  },
]

const Help = () => {
  return (
    <div>
      <h2 className="font-wittgenstein text-[18px] small:text-[22px] font-bold text-[var(--color-plum)] mb-3 small:mb-4">
        Need help?
      </h2>
      <div className="grid grid-cols-1 small:grid-cols-2 large:grid-cols-4 gap-3">
        {links.map(({ href, label, desc, Icon }) => (
          <LocalizedClientLink
            key={href}
            href={href}
            className="group flex items-start gap-3 rounded-xl border border-[var(--color-lavender)] p-4 transition-colors hover:border-[var(--color-plum)] hover:bg-[var(--color-lavender)]/30"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-lavender)]/60 text-[var(--color-plum)] transition-colors group-hover:bg-white">
              <Icon size={17} />
            </span>
            <span className="flex flex-col">
              <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                {label}
              </span>
              <span className="text-[12px] text-[var(--color-text-muted)]">
                {desc}
              </span>
            </span>
          </LocalizedClientLink>
        ))}
      </div>
    </div>
  )
}

export default Help
