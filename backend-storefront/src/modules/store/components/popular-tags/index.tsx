"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"

import { type Audience, parseAudience } from "@lib/util/sku-audience"

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

const AUDIENCE_CHIPS: Array<{ label: string; value: Audience }> = [
  { label: "For Men", value: "men" },
  { label: "For Women", value: "women" },
]

export default function PopularTags() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active = searchParams.get("tag")
  const activeAudience = parseAudience(searchParams.get("for"))

  const push = (params: URLSearchParams) => {
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`)
  }

  const setTag = (value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || active === value) params.delete("tag")
    else params.set("tag", value)
    push(params)
  }

  const setAudience = (value: Audience) => {
    const params = new URLSearchParams(searchParams.toString())
    if (activeAudience === value) params.delete("for")
    else params.set("for", value)
    push(params)
  }

  return (
    <section className="content-container pt-6">
      <div className="flex items-center gap-3 mb-3">
        <p
          className="text-[0.6875rem] uppercase tracking-[0.18em] font-semibold"
          style={{ color: "var(--color-plum)" }}
        >
          Popular right now
        </p>
        {(active || activeAudience) && (
          <button
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString())
              params.delete("tag")
              params.delete("for")
              push(params)
            }}
            className="text-[0.6875rem] underline"
            style={{ color: "var(--color-text-muted)" }}
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {/* Audience views are driven by the SKU prefix, not by a tag, so they
            live in their own toggle group ahead of the tag chips. */}
        {AUDIENCE_CHIPS.map((a) => {
          const isActive = activeAudience === a.value
          return (
            <button
              key={a.value}
              onClick={() => setAudience(a.value)}
              aria-pressed={isActive}
              className="flex-shrink-0 px-4 py-2 rounded-full text-[0.75rem] font-medium whitespace-nowrap transition-all duration-200"
              style={{
                background: isActive
                  ? "var(--color-gold)"
                  : "var(--color-bg-primary)",
                color: isActive ? "#fff" : "var(--color-text-secondary)",
                border: isActive
                  ? "1px solid var(--color-gold)"
                  : "1px solid var(--color-border)",
              }}
            >
              {a.label}
            </button>
          )
        })}

        <span
          aria-hidden="true"
          className="flex-shrink-0 self-stretch w-px my-1"
          style={{ background: "var(--color-border)" }}
        />

        {POPULAR_TAGS.map((t) => {
          const isActive = active === t.value
          return (
            <button
              key={t.value}
              onClick={() => setTag(t.value)}
              className="flex-shrink-0 px-4 py-2 rounded-full text-[0.75rem] font-medium whitespace-nowrap transition-all duration-200"
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
