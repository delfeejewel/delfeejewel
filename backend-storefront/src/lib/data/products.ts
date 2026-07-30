"use server"

import { sdk } from "@lib/config"
import { HIDDEN_PRODUCT_HANDLES } from "@lib/constants"
import { sortProducts } from "@lib/util/sort-products"
import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { LIST_PRODUCT_FIELDS, SKU_INDEX_FIELDS } from "./product-fields"
import { getRegion, retrieveRegion } from "./regions"
import { Audience, filterProductsByAudience } from "@lib/util/sku-audience"

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
}: {
  pageParam?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
  countryCode?: string
  regionId?: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
}> => {
  if (!countryCode && !regionId) {
    throw new Error("Country code or region ID is required")
  }

  const limit = queryParams?.limit || 12
  const _pageParam = Math.max(pageParam, 1)
  const offset = _pageParam === 1 ? 0 : (_pageParam - 1) * limit

  let region: HttpTypes.StoreRegion | undefined | null

  if (countryCode) {
    region = await getRegion(countryCode)
  } else {
    region = await retrieveRegion(regionId!)
  }

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("products")),
    // Revalidate product data periodically so admin edits (price, description,
    // SEO, gift_ready, etc.) appear on the storefront without a redeploy.
    // Tag-based revalidation only fires on storefront actions, never on admin
    // changes — this time window covers that gap.
    revalidate: 60,
  }

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      `/store/products`,
      {
        method: "GET",
        query: {
          limit,
          offset,
          region_id: region?.id,
          fields: LIST_PRODUCT_FIELDS,
          ...queryParams,
        },
        headers,
        next,
      }
    )
    .then(({ products, count }) => {
      // Add-on products (gift wrap) are published so carts accept them, but
      // must never appear in customer-facing listings.
      const visible = products.filter(
        (p) => !HIDDEN_PRODUCT_HANDLES.includes(p.handle ?? "")
      )
      const hidden = products.length - visible.length
      const nextPage = count > offset + limit ? pageParam + 1 : null

      return {
        response: {
          products: visible,
          count: count - hidden,
        },
        nextPage: nextPage,
        queryParams,
      }
    })
}

/**
 * The Men / Women listings, resolved from the variant SKU prefix
 * (GR/GBR → men, LR/LBR → women — see `lib/util/sku-audience`).
 *
 * `/store/products` can only filter SKUs by exact value, never by prefix, so
 * the catalogue has to be scanned. Done in two passes on purpose:
 *
 *  1. A cheap SKU-only scan of the whole scope (no price calculation) to work
 *     out WHICH products belong to the audience.
 *  2. A normal listing fetch of just those ids, with the full listing fields.
 *
 * One combined pass would mean calculating prices for the entire catalogue —
 * measured at ~9s against production versus ~1s for the scan. Splitting also
 * gives an exact count, which lets the caller hand the COMPLETE set to the
 * listing grid: no client-side backfill, and pagination is right on page 1.
 */
export const listProductsByAudience = async ({
  audience,
  countryCode,
  regionId,
  extraQueryParams,
}: {
  audience: Audience
  countryCode?: string
  regionId?: string
  extraQueryParams?: Record<string, any>
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
}> => {
  const {
    response: { products: index },
  } = await listProducts({
    pageParam: 1,
    queryParams: {
      ...extraQueryParams,
      // Matching happens after the fetch, so the whole scope has to be in hand.
      // 1000 comfortably exceeds the catalogue; revisit if it nears that.
      limit: 1000,
      fields: SKU_INDEX_FIELDS,
    } as any,
    countryCode,
    regionId,
  })

  const ids = filterProductsByAudience(index, audience).map((p) => p.id)

  if (!ids.length) {
    return { response: { products: [], count: 0 } }
  }

  const {
    response: { products },
  } = await listProducts({
    pageParam: 1,
    queryParams: { ...extraQueryParams, limit: ids.length, id: ids } as any,
    countryCode,
    regionId,
  })

  return { response: { products, count: products.length } }
}

/**
 * This will fetch 100 products to the Next.js cache and sort them based on the sortBy parameter.
 * It will then return the paginated products based on the page and limit parameters.
 */
export const listProductsWithSort = async ({
  page = 0,
  queryParams,
  sortBy = "created_at",
  countryCode,
}: {
  page?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
  sortBy?: SortOptions
  countryCode: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
}> => {
  const limit = queryParams?.limit || 12

  // Sorting (esp. by price) is computed client-side, so we must pull the WHOLE
  // result set before sorting + slicing — otherwise anything past the fetch
  // window sorts wrong and later pages render empty. 1000 comfortably exceeds
  // the catalogue; revisit if it ever approaches that.
  const {
    response: { products, count },
  } = await listProducts({
    pageParam: 0,
    queryParams: {
      ...queryParams,
      limit: 1000,
    },
    countryCode,
  })

  const sortedProducts = sortProducts(products, sortBy)

  const pageParam = (page - 1) * limit

  const nextPage = count > pageParam + limit ? pageParam + limit : null

  const paginatedProducts = sortedProducts.slice(pageParam, pageParam + limit)

  return {
    response: {
      products: paginatedProducts,
      count,
    },
    nextPage,
    queryParams,
  }
}
