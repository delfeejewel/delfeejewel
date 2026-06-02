import { Metadata } from "next"
import { Search as SearchIcon } from "lucide-react"

import { searchProducts } from "@lib/data/search"
import { getRegion } from "@lib/data/regions"
import { pageMetadata } from "@lib/util/content-seo"
import { BRAND } from "@lib/constants.brand"
import SearchResultsClient from "@modules/search/components/search-results-client"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { TRENDING_SEARCHES } from "@modules/search/lib/trending"

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ q?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  return pageMetadata({
    countryCode,
    path: "/search",
    title: "Search",
    description: `Search ${BRAND.name} for handcrafted sterling silver jewellery.`,
    noindex: true,
  })
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { countryCode } = await params
  const { q } = await searchParams
  const query = (q || "").trim()

  const [region, result] = await Promise.all([
    getRegion(countryCode),
    query
      ? searchProducts(query, countryCode)
      : Promise.resolve({ products: [], count: 0 }),
  ])

  return (
    <div className="bg-[var(--color-bg-primary)] font-outfit min-h-screen">
      <div className="content-container py-8 small:py-10">
        <header className="mb-6">
          <h1 className="font-wittgenstein text-[26px] small:text-[32px] font-bold text-[var(--color-plum)]">
            {query ? "Search Results" : "Search"}
          </h1>
          {query && (
            <p className="text-[14px] text-[var(--color-text-muted)] mt-1">
              Showing results for{" "}
              <span className="font-semibold text-[var(--color-text-secondary)]">
                &ldquo;{query}&rdquo;
              </span>
            </p>
          )}
        </header>

        {query && region ? (
          <SearchResultsClient
            initialProducts={result.products}
            initialCount={result.count}
            query={query}
            region={region}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="w-16 h-16 rounded-full bg-[var(--color-lavender)] flex items-center justify-center mb-5">
              <SearchIcon size={28} className="text-[var(--color-plum)]" />
            </div>
            <h2 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)] mb-2">
              What are you looking for?
            </h2>
            <p className="text-[14px] text-[var(--color-text-muted)] mb-6 max-w-sm">
              Use the search bar above, or start with one of these popular
              searches.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {TRENDING_SEARCHES.map((term) => (
                <LocalizedClientLink
                  key={term}
                  href={`/search?q=${encodeURIComponent(term)}`}
                  className="px-4 py-2 rounded-full text-[13px] font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-gold)]/50 hover:text-[var(--color-plum)] transition-colors"
                >
                  {term}
                </LocalizedClientLink>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
