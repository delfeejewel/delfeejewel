"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import Image from "next/image"
import {
  Search,
  X,
  Clock,
  TrendingUp,
  ArrowUpRight,
  Loader2,
  Tag,
  Layers,
  ChevronLeft,
} from "lucide-react"

import type { SearchSuggestions } from "../../lib/types"
import {
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
} from "../../lib/recent-searches"
import { TRENDING_SEARCHES } from "../../lib/trending"

const FALLBACK_IMG = "/images/fallback-no-image.png"

const EMPTY: SearchSuggestions = {
  products: [],
  categories: [],
  collections: [],
  fallback: [],
}

type Props = {
  variant?: "desktop" | "mobile"
  autoFocus?: boolean
  /** Mobile only — closes the overlay (also called after navigation). */
  onClose?: () => void
}

type NavItem =
  | { kind: "go"; href: string }
  | { kind: "term"; term: string }

export default function SearchAutocomplete({
  variant = "desktop",
  autoFocus,
  onClose,
}: Props) {
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode: string }
  const isMobile = variant === "mobile"

  const [query, setQuery] = useState("")
  const [data, setData] = useState<SearchSuggestions>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(isMobile)
  const [recent, setRecent] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setRecent(getRecentSearches())
  }, [])

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  // Debounced suggestion fetch
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setData(EMPTY)
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&country=${countryCode}`,
          { signal: ctrl.signal }
        )
        const json = (await res.json()) as SearchSuggestions
        setData(json)
      } catch (err: any) {
        if (err?.name !== "AbortError") setData(EMPTY)
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, countryCode])

  useEffect(() => {
    setActiveIndex(-1)
  }, [query])

  // Click-outside (desktop only)
  useEffect(() => {
    if (isMobile) return
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [isMobile])

  const showResults = query.trim().length >= 2
  const hasResults =
    data.products.length > 0 ||
    data.categories.length > 0 ||
    data.collections.length > 0

  const navItems = useMemo<NavItem[]>(() => {
    if (showResults) {
      return [
        ...data.products.map((p) => ({
          kind: "go" as const,
          href: `/${countryCode}/products/${p.handle}`,
        })),
        ...data.categories.map((c) => ({
          kind: "go" as const,
          href: `/${countryCode}/categories/${c.handle}`,
        })),
        ...data.collections.map((c) => ({
          kind: "go" as const,
          href: `/${countryCode}/collections/${c.handle}`,
        })),
      ]
    }
    return [
      ...recent.map((t) => ({ kind: "term" as const, term: t })),
      ...TRENDING_SEARCHES.map((t) => ({ kind: "term" as const, term: t })),
    ]
  }, [showResults, data, recent, countryCode])

  const dismiss = useCallback(() => {
    setOpen(false)
    onClose?.()
  }, [onClose])

  const go = useCallback(
    (href: string) => {
      dismiss()
      router.push(href)
    },
    [router, dismiss]
  )

  const submit = useCallback(
    (term: string) => {
      const t = term.trim()
      if (!t) return
      addRecentSearch(t)
      setRecent(getRecentSearches())
      go(`/${countryCode}/search?q=${encodeURIComponent(t)}`)
    },
    [countryCode, go]
  )

  const runItem = (item: NavItem) => {
    if (item.kind === "go") go(item.href)
    else submit(item.term)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (activeIndex >= 0 && navItems[activeIndex]) {
      runItem(navItems[activeIndex])
    } else {
      submit(query)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, navItems.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === "Escape") {
      if (isMobile) onClose?.()
      else {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
  }

  // ─── Render helpers ──────────────────────────────────
  const rowBase =
    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"

  const ProductRow = ({
    index,
    title,
    handle,
    thumbnail,
    price,
  }: {
    index: number
    title: string
    handle: string
    thumbnail: string | null
    price: string | null
  }) => (
    <button
      type="button"
      onMouseEnter={() => setActiveIndex(index)}
      onClick={() => go(`/${countryCode}/products/${handle}`)}
      className={`${rowBase} ${
        activeIndex === index
          ? "bg-[var(--color-bg-secondary)]"
          : "hover:bg-[var(--color-bg-secondary)]"
      }`}
    >
      <span className="relative w-11 h-11 shrink-0 rounded-md overflow-hidden bg-[var(--color-bg-secondary)]">
        <Image
          src={thumbnail || FALLBACK_IMG}
          alt={title}
          fill
          className="object-cover"
          sizes="44px"
        />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium text-[var(--color-text-primary)] truncate capitalize">
          {title}
        </span>
        {price && (
          <span className="block text-[12px] font-semibold text-[var(--color-plum)]">
            {price}
          </span>
        )}
      </span>
    </button>
  )

  const LinkRow = ({
    index,
    label,
    href,
    icon: Icon,
  }: {
    index: number
    label: string
    href: string
    icon: typeof Tag
  }) => (
    <button
      type="button"
      onMouseEnter={() => setActiveIndex(index)}
      onClick={() => go(href)}
      className={`${rowBase} ${
        activeIndex === index
          ? "bg-[var(--color-bg-secondary)]"
          : "hover:bg-[var(--color-bg-secondary)]"
      }`}
    >
      <span className="w-8 h-8 shrink-0 rounded-md bg-[var(--color-lavender)] flex items-center justify-center">
        <Icon size={15} className="text-[var(--color-plum)]" />
      </span>
      <span className="flex-1 text-[13px] text-[var(--color-text-secondary)] capitalize">
        {label}
      </span>
      <ArrowUpRight size={14} className="text-[var(--color-text-muted)]" />
    </button>
  )

  const TermRow = ({
    index,
    term,
    icon: Icon,
  }: {
    index: number
    term: string
    icon: typeof Clock
  }) => (
    <button
      type="button"
      onMouseEnter={() => setActiveIndex(index)}
      onClick={() => submit(term)}
      className={`${rowBase} ${
        activeIndex === index
          ? "bg-[var(--color-bg-secondary)]"
          : "hover:bg-[var(--color-bg-secondary)]"
      }`}
    >
      <Icon size={15} className="text-[var(--color-text-muted)] shrink-0" />
      <span className="flex-1 text-[13px] text-[var(--color-text-secondary)]">
        {term}
      </span>
    </button>
  )

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
      {children}
    </p>
  )

  // ─── Panel content ───────────────────────────────────
  const catOffset = data.products.length
  const colOffset = data.products.length + data.categories.length

  const panel = (
    <div data-testid="search-dropdown">
      {/* Idle state — recent + trending */}
      {!showResults && (
        <>
          {recent.length > 0 && (
            <>
              <div className="flex items-center justify-between pr-2">
                <SectionLabel>Recent searches</SectionLabel>
                <button
                  type="button"
                  onClick={() => {
                    clearRecentSearches()
                    setRecent([])
                  }}
                  className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-plum)] transition-colors"
                >
                  Clear
                </button>
              </div>
              {recent.map((term, i) => (
                <TermRow key={`r-${term}`} index={i} term={term} icon={Clock} />
              ))}
            </>
          )}
          <SectionLabel>Trending</SectionLabel>
          {TRENDING_SEARCHES.map((term, i) => (
            <TermRow
              key={`t-${term}`}
              index={recent.length + i}
              term={term}
              icon={TrendingUp}
            />
          ))}
        </>
      )}

      {/* Loading */}
      {showResults && loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-[var(--color-text-muted)]">
          <Loader2 size={16} className="animate-spin" />
          Searching...
        </div>
      )}

      {/* Results */}
      {showResults && !loading && hasResults && (
        <>
          {data.products.length > 0 && (
            <>
              <SectionLabel>Products</SectionLabel>
              {data.products.map((p, i) => (
                <ProductRow
                  key={p.id}
                  index={i}
                  title={p.title}
                  handle={p.handle}
                  thumbnail={p.thumbnail}
                  price={p.price}
                />
              ))}
            </>
          )}
          {data.categories.length > 0 && (
            <>
              <SectionLabel>Categories</SectionLabel>
              {data.categories.map((c, i) => (
                <LinkRow
                  key={c.handle}
                  index={catOffset + i}
                  label={c.label}
                  href={`/${countryCode}/categories/${c.handle}`}
                  icon={Tag}
                />
              ))}
            </>
          )}
          {data.collections.length > 0 && (
            <>
              <SectionLabel>Collections</SectionLabel>
              {data.collections.map((c, i) => (
                <LinkRow
                  key={c.handle}
                  index={colOffset + i}
                  label={c.label}
                  href={`/${countryCode}/collections/${c.handle}`}
                  icon={Layers}
                />
              ))}
            </>
          )}
          <button
            type="button"
            onClick={() => submit(query)}
            className="w-full flex items-center justify-center gap-1.5 mt-1 mb-1 mx-auto px-3 py-2.5 text-[12px] font-semibold text-[var(--color-plum)] hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors"
          >
            View all results for &ldquo;{query.trim()}&rdquo;
            <ArrowUpRight size={14} />
          </button>
        </>
      )}

      {/* No results */}
      {showResults && !loading && !hasResults && (
        <div className="py-3">
          <p className="px-3 py-2 text-[13px] text-[var(--color-text-secondary)]">
            No matches for{" "}
            <span className="font-semibold text-[var(--color-text-primary)]">
              &ldquo;{query.trim()}&rdquo;
            </span>
          </p>
          {data.fallback.length > 0 && (
            <>
              <SectionLabel>You might like</SectionLabel>
              {data.fallback.map((p) => (
                <ProductRow
                  key={p.id}
                  index={-1}
                  title={p.title}
                  handle={p.handle}
                  thumbnail={p.thumbnail}
                  price={p.price}
                />
              ))}
            </>
          )}
          <SectionLabel>Trending</SectionLabel>
          {TRENDING_SEARCHES.slice(0, 4).map((term) => (
            <TermRow key={`nt-${term}`} index={-1} term={term} icon={TrendingUp} />
          ))}
        </div>
      )}
    </div>
  )

  // ─── Layout ──────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={isMobile ? "flex flex-col h-full" : "relative w-full"}
    >
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-2">
          {isMobile && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search"
              className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <ChevronLeft
                size={20}
                className="text-[var(--color-text-secondary)]"
              />
            </button>
          )}
          <div className="relative flex-1">
            <Search
              size={isMobile ? 18 : 16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search for rings, necklaces, earrings..."
              data-testid="search-input"
              aria-label="Search products"
              autoComplete="off"
              className={`w-full ${
                isMobile ? "h-12 text-[15px]" : "h-10 text-[13px]"
              } pl-10 pr-20 rounded-full outline-none transition-all duration-200 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-plum)] focus:ring-2 focus:ring-[var(--color-plum)]/10`}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  inputRef.current?.focus()
                }}
                aria-label="Clear search"
                className="absolute right-11 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:bg-black/5 transition-colors"
              >
                <X size={14} />
              </button>
            )}
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center [background:var(--gradient-accent)]"
            >
              <Search size={15} className="text-white" />
            </button>
          </div>
        </div>
      </form>

      {/* Desktop dropdown */}
      {!isMobile && open && (
        <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-[var(--color-border)] bg-white shadow-[0_12px_40px_rgba(93,46,70,0.12)] z-50 max-h-[70vh] overflow-y-auto p-1.5">
          {panel}
        </div>
      )}

      {/* Mobile inline panel */}
      {isMobile && (
        <div className="flex-1 overflow-y-auto mt-3 -mx-1">{panel}</div>
      )}
    </div>
  )
}
