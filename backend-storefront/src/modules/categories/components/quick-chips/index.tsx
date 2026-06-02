"use client"

import { useRef } from "react"
import { motion } from "framer-motion"

const QUICK_CHIPS = [
  { label: "Under ₹1,999", filterKey: "price", filterValue: [500, 1999] },
  { label: "Daily Wear", filterKey: "occasion", filterValue: "daily-wear" },
  { label: "Bridal", filterKey: "occasion", filterValue: "bridal-wedding" },
  { label: "Anti-Tarnish", filterKey: "care", filterValue: "anti-tarnish" },
  { label: "Sterling Silver 925", filterKey: "metal", filterValue: "sterling-silver-925" },
  { label: "New Arrivals", filterKey: "collection", filterValue: "new-arrivals" },
  { label: "Best Seller", filterKey: "collection", filterValue: "best-seller" },
  { label: "Minimal", filterKey: "style", filterValue: "minimal" },
  { label: "Party Wear", filterKey: "occasion", filterValue: "party-wear" },
]

type ActiveFilters = Record<string, string[] | [number, number]>

export default function QuickChips({
  filters,
  onChange,
}: {
  filters: ActiveFilters
  onChange: (filters: ActiveFilters) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const isActive = (chip: typeof QUICK_CHIPS[0]) => {
    const val = filters[chip.filterKey]
    if (!val) return false
    if (chip.filterKey === "price") {
      const range = val as [number, number]
      const target = chip.filterValue as [number, number]
      return range[0] === target[0] && range[1] === target[1]
    }
    return (val as string[]).includes(chip.filterValue as string)
  }

  const handleClick = (chip: typeof QUICK_CHIPS[0]) => {
    const next = { ...filters }
    if (chip.filterKey === "price") {
      if (isActive(chip)) delete next[chip.filterKey]
      else next[chip.filterKey] = chip.filterValue as [number, number]
    } else {
      const current = (next[chip.filterKey] as string[]) || []
      const v = chip.filterValue as string
      if (current.includes(v)) {
        const updated = current.filter((x) => x !== v)
        if (updated.length) next[chip.filterKey] = updated
        else delete next[chip.filterKey]
      } else {
        next[chip.filterKey] = [...current, v]
      }
    }
    onChange(next)
  }

  return (
    <div className="relative mb-5">
      <div ref={scrollRef} className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth pt-2 pb-1">
        {QUICK_CHIPS.map((chip, i) => {
          const active = isActive(chip)
          return (
            <motion.button
              key={chip.label}
              onClick={() => handleClick(chip)}
              className="flex-shrink-0 px-4 py-2 rounded-full text-[12px] font-medium whitespace-nowrap"
              style={{
                background: active ? "var(--color-accent-dark)" : "var(--color-bg-primary)",
                color: active ? "#fff" : "var(--color-text-secondary)",
                border: active ? "1px solid var(--color-accent-dark)" : "1px solid var(--color-border)",
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.96 }}
            >
              {chip.label}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
