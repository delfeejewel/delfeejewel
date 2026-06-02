"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"

const POPULAR_TAGS: Array<{ label: string; value: string }> = [
  { label: "Bridal", value: "bridal" },
  { label: "Daily Wear", value: "daily-wear" },
  { label: "Anti-Tarnish", value: "anti-tarnish" },
  { label: "Sterling Silver 925", value: "sterling-silver-925" },
  { label: "Minimal", value: "minimal" },
  { label: "Party Wear", value: "party-wear" },
  { label: "Gifts for Her", value: "her" },
  { label: "Gifts for Him", value: "him" },
]

export default function PopularTags() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active = searchParams.get("tag")

  const setTag = (value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || active === value) params.delete("tag")
    else params.set("tag", value)
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <section className="content-container pt-6">
      <div className="flex items-center gap-3 mb-3">
        <p
          className="text-[11px] uppercase tracking-[0.18em] font-semibold"
          style={{ color: "var(--color-plum)" }}
        >
          Popular right now
        </p>
        {active && (
          <button
            onClick={() => setTag(null)}
            className="text-[11px] underline"
            style={{ color: "var(--color-text-muted)" }}
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {POPULAR_TAGS.map((t) => {
          const isActive = active === t.value
          return (
            <button
              key={t.value}
              onClick={() => setTag(t.value)}
              className="flex-shrink-0 px-4 py-2 rounded-full text-[12px] font-medium whitespace-nowrap transition-all duration-200"
              style={{
                background: isActive
                  ? "var(--color-plum)"
                  : "var(--color-bg-primary)",
                color: isActive ? "#fff" : "var(--color-text-secondary)",
                border: isActive
                  ? "1px solid var(--color-plum)"
                  : "1px solid var(--color-border)",
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}
