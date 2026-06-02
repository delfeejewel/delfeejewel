"use client"

import { useState, useCallback } from "react"
import { X, SlidersHorizontal, Star, RotateCcw, ChevronDown } from "lucide-react"
import Slider from "rc-slider"
import "rc-slider/assets/index.css"
import { COMMON_FILTERS, CATEGORY_FILTERS, type FilterGroup } from "./filter-config"
import { motion, AnimatePresence } from "framer-motion"

export type ActiveFilters = Record<string, string[] | [number, number]>

type FilterSidebarProps = {
  categoryHandle?: string
  filters: ActiveFilters
  onChange: (filters: ActiveFilters) => void
  productCount?: number
}

// ─── Price Range Slider ──────────────────────────────
function PriceFilter({
  group,
  value,
  onChange,
}: {
  group: FilterGroup
  value: [number, number] | undefined
  onChange: (range: [number, number] | undefined) => void
}) {
  const min = group.min || 0
  const max = group.max || 50000
  const current = value || [min, max]

  return (
    <div className="px-1">
      {/* Current range display */}
      <div className="flex items-center justify-between mb-4">
        <div
          className="px-3 py-1.5 rounded-lg text-[13px] font-medium"
          style={{ background: "var(--color-bg-secondary)", color: "var(--color-text-primary)" }}
        >
          ₹{current[0].toLocaleString("en-IN")}
        </div>
        <div className="h-[1px] flex-1 mx-3" style={{ background: "var(--color-border)" }} />
        <div
          className="px-3 py-1.5 rounded-lg text-[13px] font-medium"
          style={{ background: "var(--color-bg-secondary)", color: "var(--color-text-primary)" }}
        >
          {current[1] >= max ? "₹50,000+" : `₹${current[1].toLocaleString("en-IN")}`}
        </div>
      </div>

      {/* Slider */}
      <div className="px-1">
        <Slider
          range
          min={min}
          max={max}
          step={group.step || 500}
          value={current}
          onChange={(val) => {
            const v = val as [number, number]
            if (v[0] === min && v[1] === max) {
              onChange(undefined)
            } else {
              onChange(v)
            }
          }}
          styles={{
            track: { background: "var(--color-accent)", height: 4 },
            rail: { background: "var(--color-border)", height: 4 },
            handle: {
              background: "#fff",
              border: "2px solid var(--color-accent)",
              width: 18,
              height: 18,
              marginTop: -7,
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              opacity: 1,
            },
          }}
        />
      </div>

      {/* Quick presets */}
      {group.presets && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {group.presets.map((preset) => {
            const active = value?.[0] === preset.min && value?.[1] === preset.max
            return (
              <button
                key={preset.label}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200"
                style={{
                  background: active ? "var(--color-accent)" : "transparent",
                  color: active ? "#fff" : "var(--color-text-secondary)",
                  border: active ? "1px solid var(--color-accent)" : "1px solid var(--color-border)",
                }}
                onClick={() => {
                  if (active) {
                    onChange(undefined)
                  } else {
                    onChange([preset.min, preset.max])
                  }
                }}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Chip Select (for Gender, Occasion, Style) ───────
function ChipFilter({
  group,
  values,
  onToggle,
}: {
  group: FilterGroup
  values: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {group.options?.map((opt) => {
        const active = values.includes(opt.value)
        return (
          <button
            key={opt.value}
            className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 hover:shadow-sm"
            style={{
              background: active ? "var(--color-accent)" : "var(--color-bg-secondary)",
              color: active ? "#fff" : "var(--color-text-secondary)",
              border: active ? "1px solid var(--color-accent)" : "1px solid var(--color-border)",
            }}
            onClick={() => onToggle(opt.value)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Grid Buttons (for sizes) ────────────────────────
function GridFilter({
  group,
  values,
  onToggle,
}: {
  group: FilterGroup
  values: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {(group.options || []).map((opt) => {
        const active = values.includes(opt.value)
        return (
          <button
            key={opt.value}
            onClick={() => onToggle(opt.value)}
            className="h-9 rounded-lg text-[12px] font-medium transition-all duration-150 hover:shadow-sm"
            style={{
              background: active ? "var(--color-accent)" : "var(--color-bg-secondary)",
              color: active ? "#fff" : "var(--color-text-secondary)",
              border: active ? "1px solid var(--color-accent)" : "1px solid var(--color-border)",
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Checkbox List ───────────────────────────────────
function CheckboxFilter({
  group,
  values,
  onToggle,
}: {
  group: FilterGroup
  values: string[]
  onToggle: (value: string) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const items = group.options || []
  const visible = showAll ? items : items.slice(0, 4)
  const hasMore = items.length > 4

  return (
    <div>
      <div className="flex flex-col gap-0.5">
        {visible.map((opt) => {
          const checked = values.includes(opt.value)
          return (
            <button
              key={opt.value}
              className="flex items-center gap-2.5 py-[7px] px-2 rounded-lg transition-all duration-150 text-left w-full"
              style={{
                background: checked ? "rgba(93,46,70,0.06)" : "transparent",
              }}
              onClick={() => onToggle(opt.value)}
            >
              <div
                className="w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0 transition-all duration-200"
                style={{
                  background: checked ? "var(--color-accent)" : "transparent",
                  border: checked ? "none" : "1.5px solid var(--color-border-hover)",
                }}
              >
                {checked && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span
                className="text-[13px]"
                style={{ color: checked ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}
              >
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>
      {hasMore && (
        <button
          className="text-[12px] font-medium mt-1 pl-2"
          style={{ color: "var(--color-accent-dark)", background: "none", border: "none", cursor: "pointer" }}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Show less" : `+${items.length - 4} more`}
        </button>
      )}
    </div>
  )
}

// ─── Rating Filter ───────────────────────────────────
function RatingFilter({
  value,
  onChange,
}: {
  value: number | undefined
  onChange: (min: number | undefined) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      {[4].map((min) => {
        const active = value === min
        return (
          <button
            key={min}
            className="flex items-center gap-2 py-[7px] px-2 rounded-lg transition-all duration-150 w-full"
            style={{ background: active ? "rgba(93,46,70,0.06)" : "transparent" }}
            onClick={() => onChange(active ? undefined : min)}
          >
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={14} fill={i < min ? "#f59e0b" : "none"} stroke={i < min ? "#f59e0b" : "#ddd"} strokeWidth={1.5} />
              ))}
            </div>
            <span className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>& above</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Color Dot Filter (for stone colors) ─────────────
const COLOR_MAP: Record<string, string> = {
  white: "#f5f5f5",
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  multicolor: "conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ef4444)",
}

function ColorDotFilter({
  group,
  values,
  onToggle,
}: {
  group: FilterGroup
  values: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {(group.options || []).map((opt) => {
        const active = values.includes(opt.value)
        const bg = COLOR_MAP[opt.value] || "#ccc"
        return (
          <button
            key={opt.value}
            onClick={() => onToggle(opt.value)}
            className="flex flex-col items-center gap-1.5"
            title={opt.label}
          >
            <div
              className="w-7 h-7 rounded-full transition-all duration-200"
              style={{
                background: bg,
                border: active ? "2px solid var(--color-accent)" : "2px solid var(--color-border)",
                boxShadow: active ? "0 0 0 2px var(--color-bg-primary), 0 0 0 4px var(--color-accent)" : opt.value === "white" ? "inset 0 0 0 1px #ddd" : "none",
              }}
            />
            <span className="text-[10px]" style={{ color: active ? "var(--color-text-primary)" : "var(--color-text-muted)" }}>
              {opt.label.split(" / ")[0]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Toggle Filter (for single option like rating) ───
function ToggleFilter({
  label,
  icon,
  active,
  onToggle,
}: {
  label: string
  icon: React.ReactNode
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full py-2 px-3 rounded-lg transition-all duration-200"
      style={{
        background: active ? "rgba(93,46,70,0.08)" : "var(--color-bg-secondary)",
        border: active ? "1px solid var(--color-accent)" : "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[13px] font-medium" style={{ color: active ? "var(--color-accent-dark)" : "var(--color-text-secondary)" }}>
          {label}
        </span>
      </div>
      <div
        className="w-8 h-[18px] rounded-full relative transition-all duration-200"
        style={{ background: active ? "var(--color-accent)" : "var(--color-border)" }}
      >
        <div
          className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all duration-200"
          style={{ left: active ? 16 : 2 }}
        />
      </div>
    </button>
  )
}

// ─── Filter Group Wrapper ────────────────────────────
const CHIP_GROUPS = ["gender", "occasion", "style", "collection", "availability", "care", "weight", "finish", "ring_type", "earring_type", "closure", "necklace_type", "bracelet_type"]
const COLOR_GROUPS = ["stone_color"]

function FilterGroupWrapper({
  group,
  values,
  onToggle,
  onRangeChange,
  onRatingChange,
  defaultOpen = false,
  isLast = false,
}: {
  group: FilterGroup
  values: string[] | [number, number] | undefined
  onToggle: (key: string, value: string) => void
  onRangeChange: (key: string, range: [number, number] | undefined) => void
  onRatingChange: (key: string, min: number | undefined) => void
  defaultOpen?: boolean
  isLast?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const hasActive = Array.isArray(values) && values.length > 0
  const isChip = CHIP_GROUPS.includes(group.key)
  const isColor = COLOR_GROUPS.includes(group.key)

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 text-left"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {group.label}
          </span>
          {hasActive && (
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              {(values as string[]).length}
            </span>
          )}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} color="#999" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div className="pb-3">
              {group.type === "range" && (
                <PriceFilter
                  group={group}
                  value={values as [number, number] | undefined}
                  onChange={(range) => onRangeChange(group.key, range)}
                />
              )}
              {group.type === "rating" && (
                <ToggleFilter
                  label="4★ & above"
                  icon={
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} size={12} fill={i < 4 ? "#f59e0b" : "none"} stroke={i < 4 ? "#f59e0b" : "#ddd"} strokeWidth={1.5} />
                      ))}
                    </div>
                  }
                  active={!!(values as string[])?.length}
                  onToggle={() => onRatingChange(group.key, (values as string[])?.length ? undefined : 4)}
                />
              )}
              {group.type === "checkbox" && isColor && (
                <ColorDotFilter
                  group={group}
                  values={(values as string[]) || []}
                  onToggle={(v) => onToggle(group.key, v)}
                />
              )}
              {group.type === "checkbox" && isChip && !isColor && (
                <ChipFilter
                  group={group}
                  values={(values as string[]) || []}
                  onToggle={(v) => onToggle(group.key, v)}
                />
              )}
              {group.type === "checkbox" && !isChip && !isColor && (
                <CheckboxFilter
                  group={group}
                  values={(values as string[]) || []}
                  onToggle={(v) => onToggle(group.key, v)}
                />
              )}
              {group.type === "grid" && (
                <GridFilter
                  group={group}
                  values={(values as string[]) || []}
                  onToggle={(v) => onToggle(group.key, v)}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isLast && <div className="h-[1px]" style={{ background: "var(--color-border)" }} />}
    </div>
  )
}

// ─── Active Filter Pills ─────────────────────────────
function ActiveFilterPills({
  filters,
  allGroups,
  onRemove,
  onClear,
}: {
  filters: ActiveFilters
  allGroups: FilterGroup[]
  onRemove: (key: string, value: string) => void
  onClear: () => void
}) {
  const pills: { key: string; value: string; label: string }[] = []

  Object.entries(filters).forEach(([key, values]) => {
    if (!values || !values.length) return
    const group = allGroups.find((g) => g.key === key)
    if (!group) return

    if (group.type === "range") {
      const [min, max] = values as [number, number]
      pills.push({ key, value: "range", label: `₹${min.toLocaleString("en-IN")} – ₹${max.toLocaleString("en-IN")}` })
    } else if (group.type === "rating") {
      pills.push({ key, value: "rating", label: `${(values as string[])[0]}★ & above` })
    } else {
      ;(values as string[]).forEach((v) => {
        const opt = group.options?.find((o) => o.value === v)
        pills.push({ key, value: v, label: opt?.label || v })
      })
    }
  })

  if (!pills.length) return null

  return (
    <div className="mb-4 p-3 rounded-xl" style={{ background: "var(--color-bg-secondary)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          Active Filters
        </span>
        <button
          className="flex items-center gap-1 text-[11px] font-medium"
          style={{ color: "var(--color-accent-dark)", background: "none", border: "none", cursor: "pointer" }}
          onClick={onClear}
        >
          <RotateCcw size={10} />
          Clear all
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {pills.map((pill) => (
          <button
            key={`${pill.key}-${pill.value}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200 hover:opacity-80"
            style={{
              background: "var(--color-bg-primary)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            }}
            onClick={() => onRemove(pill.key, pill.value)}
          >
            {pill.label}
            <X size={10} style={{ color: "var(--color-text-muted)" }} />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main Filter Sidebar ─────────────────────────────
export default function FilterSidebar({
  categoryHandle,
  filters,
  onChange,
  productCount,
}: FilterSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const categoryFilters = categoryHandle ? CATEGORY_FILTERS[categoryHandle] || [] : []
  const allGroups = [...categoryFilters, ...COMMON_FILTERS]
  const activeCount = Object.values(filters).filter((v) => v && v.length > 0).length

  const handleToggle = useCallback((key: string, value: string) => {
    const current = (filters[key] as string[]) || []
    const updated = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    const next = { ...filters }
    if (updated.length) next[key] = updated; else delete next[key]
    onChange(next)
  }, [filters, onChange])

  const handleRange = useCallback((key: string, range: [number, number] | undefined) => {
    const next = { ...filters }
    if (range) next[key] = range; else delete next[key]
    onChange(next)
  }, [filters, onChange])

  const handleRating = useCallback((key: string, min: number | undefined) => {
    const next = { ...filters }
    if (min) next[key] = [`${min}`]; else delete next[key]
    onChange(next)
  }, [filters, onChange])

  const handleRemove = useCallback((key: string, value: string) => {
    const group = allGroups.find((g) => g.key === key)
    if (group?.type === "range" || group?.type === "rating") {
      const next = { ...filters }
      delete next[key]
      onChange(next)
    } else {
      handleToggle(key, value)
    }
  }, [filters, allGroups, onChange, handleToggle])

  const filterContent = (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} strokeWidth={2} style={{ color: "var(--color-text-primary)" }} />
          <span className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Filters</span>
          {activeCount > 0 && (
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            className="flex items-center gap-1 text-[12px] font-medium"
            style={{ color: "var(--color-accent-dark)", background: "none", border: "none", cursor: "pointer" }}
            onClick={() => onChange({})}
          >
            <RotateCcw size={11} />
            Reset
          </button>
        )}
      </div>

      {/* Count */}
      {productCount !== undefined && (
        <div className="text-[12px] mb-3" style={{ color: "var(--color-text-muted)" }}>
          Showing {productCount} product{productCount !== 1 ? "s" : ""}
        </div>
      )}

      {/* Active pills */}
      <ActiveFilterPills filters={filters} allGroups={allGroups} onRemove={handleRemove} onClear={() => onChange({})} />

      {/* Ordered filters — all in one list, specific order */}
      {(() => {
        const order = [
          "price", "metal", "occasion", "style", "gender",
          "stone_type", "stone_color", "finish", "rating",
        ]
        const ordered = order
          .map((key) => allGroups.find((g) => g.key === key))
          .filter(Boolean) as FilterGroup[]

        // Add category-specific filters at the top
        const catFirst = categoryFilters.filter((g) => !order.includes(g.key))

        const all = [...catFirst, ...ordered]
        return all.map((group, i) => (
          <FilterGroupWrapper
            key={group.key}
            group={group}
            values={filters[group.key]}
            onToggle={handleToggle}
            onRangeChange={handleRange}
            onRatingChange={handleRating}
            defaultOpen={i < 3}
            isLast={i === all.length - 1}
          />
        ))
      })()}
    </div>
  )

  return (
    <>
      {/* Mobile trigger */}
      <button
        className="small:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-6 py-3 rounded-full shadow-xl text-sm font-semibold text-white"
        style={{ background: "var(--color-accent-dark)" }}
        onClick={() => setMobileOpen(true)}
      >
        <SlidersHorizontal size={16} />
        Filters
        {activeCount > 0 && (
          <span className="bg-white text-[11px] w-5 h-5 rounded-full flex items-center justify-center font-bold" style={{ color: "var(--color-accent-dark)" }}>
            {activeCount}
          </span>
        )}
      </button>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="small:hidden fixed inset-0 z-50 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="small:hidden fixed right-0 top-0 bottom-0 z-50 w-[88%] max-w-[380px] overflow-y-auto"
              style={{ background: "var(--color-bg-primary)" }}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4" style={{ background: "var(--color-bg-primary)", borderBottom: "1px solid var(--color-border)" }}>
                <span className="text-base font-bold">Filters</span>
                <button onClick={() => setMobileOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <X size={20} />
                </button>
              </div>
              <div className="p-5">{filterContent}</div>
              {/* Apply button */}
              <div className="sticky bottom-0 px-5 py-4" style={{ background: "var(--color-bg-primary)", borderTop: "1px solid var(--color-border)" }}>
                <button
                  className="w-full py-3 rounded-full text-sm font-semibold text-white"
                  style={{ background: "var(--color-accent-dark)" }}
                  onClick={() => setMobileOpen(false)}
                >
                  Show {productCount} product{productCount !== 1 ? "s" : ""}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <div
        className="hidden small:block w-[270px] flex-shrink-0 overflow-y-auto rounded-xl p-4"
        style={{
          maxHeight: "calc(100vh - 180px)",
          position: "sticky",
          top: 120,
          border: "1px solid var(--color-border)",
          background: "var(--color-bg-primary)",
        }}
      >
        {filterContent}
      </div>
    </>
  )
}
