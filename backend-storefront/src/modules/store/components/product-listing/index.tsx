"use client"

import { useState, useMemo, useEffect } from "react"
import { HttpTypes } from "@medusajs/types"
import { motion } from "framer-motion"
import { PackageSearch, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

import { listProducts } from "@lib/data/products"
import FilterSidebar, {
  type ActiveFilters,
} from "@modules/store/components/filters/filter-sidebar"
import QuickChips from "@modules/categories/components/quick-chips"
import SortBar, {
  type SortOption,
} from "@modules/categories/components/sort-bar"
import ProductCard from "@modules/categories/components/product-card"
import TrustBadges from "@modules/categories/components/trust-badges"

const PRODUCTS_PER_PAGE = 12

// Pages of this size are fetched client-side to load the full catalogue
// (see the effect below). Not a cap — anything beyond the server's first-paint
// batch still loads here.
const FETCH_BATCH = 100

type Props = {
  initialProducts: HttpTypes.StoreProduct[]
  initialCount: number
  region: HttpTypes.StoreRegion
  /** When listing within a category, lets the filter sidebar surface category-specific facets. */
  categoryHandle?: string
  /** When true, hides the QuickChips row (e.g. on /store where global tag chips live elsewhere). */
  hideQuickChips?: boolean
  /** When true, hides the bottom TrustBadges row (host can render its own). */
  hideTrustBadges?: boolean
  /**
   * Backend filters that scope this listing (e.g. { tag_id } on /store,
   * { collection_id } on a collection). The client-side "load the rest"
   * fetches reuse these so they stay within the same scope.
   */
  fetchParams?: Record<string, any>
}

export default function ProductListingClient({
  initialProducts,
  initialCount,
  region,
  categoryHandle,
  hideQuickChips,
  hideTrustBadges,
  fetchParams,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [filters, setFilters] = useState<ActiveFilters>({})
  const [sortBy, setSortBy] = useState<SortOption>("popular")
  const [gridCols, setGridCols] = useState<2 | 3 | 4>(3)

  // The store grid is client-driven: it starts with the server's first-paint
  // batch, then pulls the rest of the catalogue page-by-page so filtering,
  // sorting and pagination all run over the COMPLETE set (no hard cap). SEO
  // isn't needed on this listing page, so client-side completion is fine.
  const [allProducts, setAllProducts] = useState(initialProducts)
  const [loadingMore, setLoadingMore] = useState(false)

  // Stable dep for the scope filters (object identity changes each render).
  const fetchKey = JSON.stringify(fetchParams || {})

  useEffect(() => {
    let cancelled = false
    setAllProducts(initialProducts)

    if (initialProducts.length >= initialCount) {
      setLoadingMore(false)
      return
    }

    ;(async () => {
      setLoadingMore(true)
      const pages = Math.ceil(initialCount / FETCH_BATCH)
      const all: HttpTypes.StoreProduct[] = []
      for (let p = 1; p <= pages; p++) {
        if (cancelled) return
        try {
          const { response } = await listProducts({
            pageParam: p,
            queryParams: { limit: FETCH_BATCH, ...(fetchParams || {}) },
            regionId: region.id,
          })
          all.push(...response.products)
        } catch {
          break
        }
      }
      if (!cancelled && all.length) setAllProducts(all)
      if (!cancelled) setLoadingMore(false)
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProducts, initialCount, fetchKey, region.id])

  const currentPage = Number(searchParams.get("page") || "1")

  const filteredProducts = useMemo(() => {
    let products = [...allProducts]

    if (filters.price) {
      const [min, max] = filters.price as [number, number]
      products = products.filter((p) => {
        const price = p.variants?.[0]?.calculated_price?.calculated_amount
        if (!price) return true
        return price >= min && price <= max
      })
    }

    const metadataKeys = [
      "metal", "finish", "stone_type", "stone_color", "gender",
      "occasion", "style", "collection", "care", "weight",
      "ring_size", "ring_type", "earring_type", "closure",
      "necklace_type", "chain_length", "bracelet_type", "bracelet_size",
    ]

    metadataKeys.forEach((key) => {
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
  }, [allProducts, filters, sortBy])

  const hasActiveFilters = Object.values(filters).some((v) => v && v.length > 0)
  const displayCount = hasActiveFilters ? filteredProducts.length : initialCount

  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE
  )

  // True while the full catalogue is still arriving (or hasn't started). Used
  // to show a loader instead of the "No products found" empty state when the
  // current page's slice is empty only because later products aren't loaded yet.
  const isLoadingCatalogue = loadingMore || allProducts.length < initialCount

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
      {!hideQuickChips && <QuickChips filters={filters} onChange={setFilters} />}

      <div className="flex flex-col small:flex-row gap-6">
        <FilterSidebar
          categoryHandle={categoryHandle}
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

          {loadingMore && paginatedProducts.length > 0 && (
            <div
              className="flex items-center gap-2 py-2 text-[13px]"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <Loader2 size={14} className="animate-spin" />
              Loading the full collection…
            </div>
          )}

          {paginatedProducts.length > 0 ? (
            <>
              <motion.div className={`grid ${gridClass} gap-3 small:gap-4`} layout>
                {paginatedProducts.map((product, i) => (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.3,
                      delay: Math.min(i * 0.03, 0.3),
                    }}
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
          ) : isLoadingCatalogue ? (
            <div
              className="flex flex-col items-center justify-center py-20 text-center"
              style={{ color: "var(--color-text-muted)" }}
            >
              <Loader2 size={28} className="animate-spin mb-4" />
              <p className="text-sm">Loading products…</p>
            </div>
          ) : (
            <motion.div
              className="flex flex-col items-center justify-center py-20 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
                style={{ background: "var(--color-bg-secondary)" }}
              >
                <PackageSearch
                  size={28}
                  style={{ color: "var(--color-text-muted)" }}
                />
              </div>
              <h3
                className="font-wittgenstein text-xl mb-2"
                style={{ color: "var(--color-text-primary)" }}
              >
                No products found
              </h3>
              <p
                className="text-sm mb-6 max-w-sm"
                style={{ color: "var(--color-text-muted)" }}
              >
                Try adjusting your filters or browse our other collections for
                something you&#39;ll love.
              </p>
              <button
                className="px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: "var(--color-accent-dark)",
                  color: "#fff",
                }}
                onClick={() => setFilters({})}
              >
                Clear all filters
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {!hideTrustBadges && <TrustBadges />}
    </>
  )
}
