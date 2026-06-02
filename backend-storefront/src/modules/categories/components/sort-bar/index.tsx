"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, LayoutGrid, Grid3x3 } from "lucide-react"

export type SortOption = "popular" | "price_asc" | "price_desc" | "newest" | "discount"

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "popular", label: "Popularity" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest First" },
  { value: "discount", label: "Discount" },
]

export default function SortBar({
  sortBy,
  onSort,
  productCount,
  gridCols,
  onGridChange,
}: {
  sortBy: SortOption
  onSort: (sort: SortOption) => void
  productCount: number
  gridCols: 2 | 3 | 4
  onGridChange: (cols: 2 | 3 | 4) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const currentLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label || "Sort"

  return (
    <div className="flex items-center justify-between mb-5">
      <span className="text-[13px]" style={{ color: "var(--color-text-muted)" }}>
        {productCount} product{productCount !== 1 ? "s" : ""}
      </span>

      <div className="flex items-center gap-3">
        {/* Sort dropdown */}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-200"
            style={{
              background: "var(--color-bg-primary)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            }}
          >
            Sort: {currentLabel}
            <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
          </button>

          {open && (
            <div
              className="absolute right-0 top-full mt-1 py-1 rounded-lg shadow-lg z-30 min-w-[200px]"
              style={{ background: "var(--color-bg-primary)", border: "1px solid var(--color-border)" }}
            >
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { onSort(opt.value); setOpen(false) }}
                  className="w-full text-left px-4 py-2.5 text-[13px] transition-all duration-150 hover:bg-black/[0.03]"
                  style={{
                    color: sortBy === opt.value ? "var(--color-accent-dark)" : "var(--color-text-secondary)",
                    fontWeight: sortBy === opt.value ? 600 : 400,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid toggle — desktop only, after sort */}
        <div className="hidden small:flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--color-bg-secondary)" }}>
          {([2, 3, 4] as const).map((cols) => (
            <button
              key={cols}
              onClick={() => onGridChange(cols)}
              className="p-1.5 rounded-md transition-all duration-200"
              style={{
                background: gridCols === cols ? "var(--color-bg-primary)" : "transparent",
                boxShadow: gridCols === cols ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
              title={`${cols} columns`}
            >
              {cols === 2 && <LayoutGrid size={14} color={gridCols === cols ? "var(--color-text-primary)" : "var(--color-text-muted)"} />}
              {cols === 3 && <Grid3x3 size={14} color={gridCols === cols ? "var(--color-text-primary)" : "var(--color-text-muted)"} />}
              {cols === 4 && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="0.5" y="0.5" width="2.5" height="2.5" rx="0.5" fill={gridCols === cols ? "var(--color-text-primary)" : "var(--color-text-muted)"} />
                  <rect x="4" y="0.5" width="2.5" height="2.5" rx="0.5" fill={gridCols === cols ? "var(--color-text-primary)" : "var(--color-text-muted)"} />
                  <rect x="7.5" y="0.5" width="2.5" height="2.5" rx="0.5" fill={gridCols === cols ? "var(--color-text-primary)" : "var(--color-text-muted)"} />
                  <rect x="11" y="0.5" width="2.5" height="2.5" rx="0.5" fill={gridCols === cols ? "var(--color-text-primary)" : "var(--color-text-muted)"} />
                  <rect x="0.5" y="4" width="2.5" height="2.5" rx="0.5" fill={gridCols === cols ? "var(--color-text-primary)" : "var(--color-text-muted)"} />
                  <rect x="4" y="4" width="2.5" height="2.5" rx="0.5" fill={gridCols === cols ? "var(--color-text-primary)" : "var(--color-text-muted)"} />
                  <rect x="7.5" y="4" width="2.5" height="2.5" rx="0.5" fill={gridCols === cols ? "var(--color-text-primary)" : "var(--color-text-muted)"} />
                  <rect x="11" y="4" width="2.5" height="2.5" rx="0.5" fill={gridCols === cols ? "var(--color-text-primary)" : "var(--color-text-muted)"} />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
