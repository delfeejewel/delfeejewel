import { Suspense } from "react"
import { notFound } from "next/navigation"

import { listProducts, listProductsByAudience } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { getTagByValue } from "@lib/data/tags"
import { Audience } from "@lib/util/sku-audience"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import ListingHero from "@modules/store/components/listing-hero"
import ProductListingClient from "@modules/store/components/product-listing"
import BrowseCategories from "@modules/store/components/browse-categories"
import PopularTags from "@modules/store/components/popular-tags"
import RecentlyViewed from "@modules/store/components/recently-viewed"
import StaffPicks from "@modules/store/components/staff-picks"
import TrustBadges from "@modules/categories/components/trust-badges"

// First-paint batch fetched on the server for a fast initial render. This is
// NOT a cap: ProductListingClient loads the rest of the catalogue page-by-page
// on the client, so products beyond this still appear. SEO isn't needed on the
// listing page, which is why client-side completion is acceptable here.
const PRODUCT_LIMIT = 48
const STAFF_PICK_LIMIT = 10

const TAG_TITLES: Record<string, { title: string; tagline: string }> = {
  him: { title: "Shop for Him", tagline: "Pieces with quiet strength." },
  her: { title: "Shop for Her", tagline: "Designed to feel personal." },
  wife: { title: "Gifts for Wife", tagline: "For the woman who has your heart." },
  husband: {
    title: "Gifts for Husband",
    tagline: "Refined accents that go everywhere.",
  },
  mother: { title: "Gifts for Mother", tagline: "Heirlooms in the making." },
  sister: {
    title: "Gifts for Sister",
    tagline: "Easy-wear pieces she'll keep reaching for.",
  },
  bridal: {
    title: "Bridal Edit",
    tagline: "Timeless pieces for the most-photographed day.",
  },
  "daily-wear": {
    title: "Daily Wear",
    tagline: "Anti-tarnish staples for every routine.",
  },
  "anti-tarnish": {
    title: "Anti-Tarnish Edit",
    tagline: "Lasts through everyday — no polish required.",
  },
  "sterling-silver-925": {
    title: "Sterling Silver 925",
    tagline: "Sterling silver quality, certified at the source.",
  },
  minimal: {
    title: "Minimal",
    tagline: "Quiet luxury in restrained shapes.",
  },
  "party-wear": {
    title: "Party Wear",
    tagline: "Statement pieces that earn the spotlight.",
  },
}

const AUDIENCE_TITLES: Record<Audience, { title: string; tagline: string }> = {
  men: { title: "Shop for Men", tagline: "Pieces with quiet strength." },
  women: { title: "Shop for Women", tagline: "Designed to feel personal." },
}

export default async function StoreTemplate({
  sortBy,
  page,
  countryCode,
  tag,
  audience,
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  tag?: string
  audience?: Audience
}) {
  const region = await getRegion(countryCode)
  if (!region) notFound()

  // Resolve tag → tag id (if present)
  const tagId = tag ? await getTagByValue(tag) : null

  const tagParams = tag && tagId ? { tag_id: [tagId] } : undefined

  // Anything that narrows the catalogue suppresses the landing-page sections
  // (category browser, staff picks) and switches the hero to a filtered title.
  const isFiltered = Boolean(tag || audience)

  // Main product list (scoped by tag and/or audience if provided).
  //
  // The audience match runs on SKU prefixes after the fetch, so that path pulls
  // the whole scope at once and hands the COMPLETE set to the grid below —
  // which is why `fetchParams` stays undefined there (no client backfill, and
  // the count is already exact).
  const { response } = audience
    ? await listProductsByAudience({
        audience,
        countryCode,
        extraQueryParams: tagParams,
      })
    : await listProducts({
        pageParam: 1,
        queryParams: { limit: PRODUCT_LIMIT, ...(tagParams || {}) } as any,
        countryCode,
      })

  // Staff picks render only on the un-filtered landing (see `!tag` below), and
  // there the main query is itself un-filtered — so we pick them out of the
  // batch we already have rather than paying for a second catalogue fetch.
  const staffPicks = (isFiltered ? [] : response.products || [])
    .filter((p) => {
      const meta = (p.metadata as any) || {}
      return (
        meta.badge === "staff-pick" ||
        meta.collection === "staff-picks" ||
        meta.staff_pick === true
      )
    })
    .slice(0, STAFF_PICK_LIMIT)

  const heroMeta = audience
    ? AUDIENCE_TITLES[audience]
    : tag
    ? TAG_TITLES[tag] || {
        title: `Tagged: ${tag}`,
        tagline: "Hand-picked pieces matching this filter.",
      }
    : {
        title: "Everything we make",
        tagline: "Browse the full catalogue — filter, sort, and find your favourites.",
      }

  return (
    <div data-testid="store-container">
      {/* Browse by category — only on the un-filtered store landing */}
      {!isFiltered && (
        <Suspense fallback={null}>
          <BrowseCategories />
        </Suspense>
      )}

      <div className={isFiltered ? "" : "mt-8 small:mt-10"}>
        <ListingHero
          eyebrow={isFiltered ? "Filtered" : "Store"}
          title={heroMeta.title}
          tagline={heroMeta.tagline}
          productCount={response.count}
        />
      </div>

      <PopularTags />

      {!isFiltered && staffPicks.length > 0 && (
        <StaffPicks products={staffPicks} />
      )}

      <div className="content-container py-6">
        <ProductListingClient
          initialProducts={response.products}
          initialCount={response.count}
          region={region}
          fetchParams={audience ? undefined : tagParams}
          hideTrustBadges
        />
      </div>

      <RecentlyViewed regionId={region.id} />

      <TrustBadges />
    </div>
  )
}
