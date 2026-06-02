"use client"

import { useState, useMemo } from "react"
import { HttpTypes } from "@medusajs/types"
import { motion } from "framer-motion"
import { SearchX, ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

import FilterSidebar, {
  type ActiveFilters,
} from "@modules/store/components/filters/filter-sidebar"
import QuickChips from "@modules/categories/components/quick-chips"
import SortBar, { type SortOption } from "@modules/categories/components/sort-bar"
import ProductCard from "@modules/categories/components/product-card"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { TRENDING_SEARCHES } from "@modules/search/lib/trending"

const PRODUCTS_PER_PAGE = 12

const METADATA_KEYS = [
  "metal", "finish", "stone_type", "stone_color", "gender",
  "occasion", "style", "collection", "care", "weight",
  "ring_size", "ring_type", "earring_type", "closure",
  "necklace_type", "chain_length", "bracelet_type", "bracelet_size",
]

type Props = {
  initialProducts: HttpTypes.StoreProduct[]
  initialCount: number
  query: string
  region: HttpTypes.StoreRegion
}

export default function SearchResultsClient({
  initialProducts,
  initialCount,
  query,
  region,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [filters, setFilters] = useState<ActiveFilters>({})
  const [sortBy, setSortBy] = useState<SortOption>("popular")
  const [gridCols, setGridCols] = useState<2 | 3 | 4>(3)

  const currentPage = Number(searchParams.get("page") || "1")

  const filteredProducts = useMemo(() => {
    let products = [...initialProducts]

    if (filters.price) {
      const [min, max] = filters.price as [number, number]
      products = products.filter((p) => {
        const price = p.variants?.[0]?.calculated_price?.calculated_amount
        if (!price) return true
        return price >= min && price <= max
      })
    }

    METADATA_KEYS.forEach((key) => {
      const selected = filters[key] as string[] | undefined
      if (!selected?.length) return
      products = products.filter((p) => {
        const value = (p.metadata as any)?.[key]
        if (!value) return false
        if (Array.isArray(value)) return selected.some((s) => value.includes(s))
        return selected.includes(value)
      })
    })

    if ((filters.availability as string[])?.includes("in-stock")) {
      products = products.filter((p) =>
        p.variants?.some((v: any) => (v.inventory_quantity || 0) > 0)
      )
    }

    if (sortBy === "price_asc") {
      products.sort(
        (a, b) =>
          (a.variants?.[0]?.calculated_price?.calculated_amount || 0) -
          (b.variants?.[0]?.calculated_price?.calculated_amount || 0)
      )
    } else if (sortBy === "price_desc") {
      products.sort(
        (a, b) =>
          (b.variants?.[0]?.calculated_price?.calculated_amount || 0) -
          (a.variants?.[0]?.calculated_price?.calculated_amount || 0)
      )
    } else if (sortBy === "newest") {
      products.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      )
    }

    return products
  }, [initialProducts, filters, sortBy])

  const hasActiveFilters = Object.values(filters).some(
    (v) => v && v.length > 0
  )
  const displayCount = filteredProducts.length

  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE
  )

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page <= 1) params.delete("page")
    else params.set("page", String(page))
    router.push(`${pathname}?${params.toString()}`, { scroll: true })
  }

  const gridClass =
    gridCols === 2
      ? "grid-cols-2"
      : gridCols === 3
        ? "grid-cols-2 small:grid-cols-3"
        : "grid-cols-2 small:grid-cols-3 medium:grid-cols-4"

  return (
    <>
      <QuickChips filters={filters} onChange={setFilters} />

      <div className="flex flex-col small:flex-row gap-6">
        <FilterSidebar
          filters={filters}
          onChange={setFilters}
          productCount={displayCount}
        />

        <div className="flex-1 min-w-0">
          <SortBar
            sortBy={sortBy}
            onSort={setSortBy}
            productCount={displayCount}
            gridCols={gridCols}
            onGridChange={setGridCols}
          />

          {paginatedProducts.length > 0 ? (
            <>
              <motion.div className={`grid ${gridClass} gap-3 small:gap-4`} layout>
                {paginatedProducts.map((product, i) => (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                  >
                    <ProductCard product={product} region={region} />
                  </motion.div>
                ))}
              </motion.div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 disabled:opacity-30"
                    style={{ border: "1px solid var(--color-border)" }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-[13px] font-medium transition-all duration-200"
                        style={{
                          background:
                            page === currentPage
                              ? "var(--color-accent-dark)"
                              : "transparent",
                          color:
                            page === currentPage
                              ? "#fff"
                              : "var(--color-text-secondary)",
                          border:
                            page === currentPage
                              ? "none"
                              : "1px solid var(--color-border)",
                        }}
                      >
                        {page}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 disabled:opacity-30"
                    style={{ border: "1px solid var(--color-border)" }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center mb-5">
                <SearchX size={28} className="text-[var(--color-text-muted)]" />
              </div>

              {initialProducts.length === 0 ? (
                <>
                  <h3 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)] mb-2">
                    No results found
                  </h3>
                  <p className="text-[14px] text-[var(--color-text-muted)] mb-6 max-w-sm">
                    We couldn&apos;t find anything for &ldquo;{query}&rdquo;.
                    Try a different term or explore these:
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                    {TRENDING_SEARCHES.slice(0, 5).map((term) => (
                      <LocalizedClientLink
                        key={term}
                        href={`/search?q=${encodeURIComponent(term)}`}
                        className="px-3.5 py-1.5 rounded-full text-[12px] font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-gold)]/50 hover:text-[var(--color-plum)] transition-colors"
                      >
                        {term}
                      </LocalizedClientLink>
                    ))}
                  </div>
                  <LocalizedClientLink
                    href="/store"
                    className="px-6 py-2.5 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 transition-all"
                  >
                    Browse All Products
                  </LocalizedClientLink>
                </>
              ) : (
                <>
                  <h3 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)] mb-2">
                    No products match your filters
                  </h3>
                  <p className="text-[14px] text-[var(--color-text-muted)] mb-6 max-w-sm">
                    Try adjusting or clearing your filters to see more results.
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={() => setFilters({})}
                      className="px-6 py-2.5 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 transition-all"
                    >
                      Clear All Filters
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
