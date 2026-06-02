import "server-only"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getProductPrice } from "@lib/util/get-product-price"
import { getCacheOptions } from "./cookies"
import { getRegion } from "./regions"
import { listCategories } from "./categories"
import { listCollections } from "./collections"
import type {
  SearchSuggestions,
  SuggestProduct,
} from "@modules/search/lib/types"

const SUGGEST_FIELDS = "*variants.calculated_price,+metadata"
const RESULT_FIELDS =
  "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags,*categories"

function toSuggestProduct(product: HttpTypes.StoreProduct): SuggestProduct {
  let price: string | null = null
  try {
    const { cheapestPrice } = getProductPrice({ product })
    price = cheapestPrice?.calculated_price ?? null
  } catch {
    price = null
  }
  return {
    id: product.id,
    title: product.title ?? "",
    handle: product.handle ?? "",
    thumbnail: product.thumbnail ?? product.images?.[0]?.url ?? null,
    price,
  }
}

/**
 * Full product search for the /search results page.
 * Returns a window of products matching the query (filtered/sorted client-side).
 */
export async function searchProducts(
  query: string,
  countryCode: string,
  limit = 100
): Promise<{ products: HttpTypes.StoreProduct[]; count: number }> {
  const q = query?.trim()
  if (!q) return { products: [], count: 0 }

  const region = await getRegion(countryCode)
  if (!region) return { products: [], count: 0 }

  const next = { ...(await getCacheOptions("products")) }

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      "/store/products",
      {
        method: "GET",
        query: { q, limit, region_id: region.id, fields: RESULT_FIELDS },
        next,
        cache: "force-cache",
      }
    )
    .then(({ products, count }) => ({ products, count }))
    .catch(() => ({ products: [], count: 0 }))
}

/**
 * Lightweight autocomplete suggestions — products, matching categories &
 * collections, plus fallback recommendations when nothing matches.
 */
export async function searchSuggestions(
  query: string,
  countryCode: string
): Promise<SearchSuggestions> {
  const empty: SearchSuggestions = {
    products: [],
    categories: [],
    collections: [],
    fallback: [],
  }

  const q = query?.trim()
  if (!q || q.length < 2) return empty

  const region = await getRegion(countryCode)
  if (!region) return empty

  const next = { ...(await getCacheOptions("products")) }
  const lc = q.toLowerCase()

  const [products, categories, collectionResult] = await Promise.all([
    sdk.client
      .fetch<{ products: HttpTypes.StoreProduct[] }>("/store/products", {
        method: "GET",
        query: { q, limit: 6, region_id: region.id, fields: SUGGEST_FIELDS },
        next,
        cache: "force-cache",
      })
      .then(({ products }) => products)
      .catch(() => [] as HttpTypes.StoreProduct[]),
    listCategories({ limit: 100 }).catch(
      () => [] as HttpTypes.StoreProductCategory[]
    ),
    listCollections({ limit: "100" }).catch(() => ({
      collections: [] as HttpTypes.StoreCollection[],
      count: 0,
    })),
  ])

  const matchedCategories = (categories || [])
    .filter((c) => (c.name || "").toLowerCase().includes(lc))
    .slice(0, 4)
    .map((c) => ({ label: c.name, handle: c.handle }))

  const matchedCollections = (collectionResult.collections || [])
    .filter((c) => (c.title || "").toLowerCase().includes(lc))
    .slice(0, 3)
    .map((c) => ({ label: c.title, handle: c.handle }))

  let fallback: SuggestProduct[] = []
  if (products.length === 0) {
    fallback = await sdk.client
      .fetch<{ products: HttpTypes.StoreProduct[] }>("/store/products", {
        method: "GET",
        query: {
          limit: 4,
          region_id: region.id,
          order: "-created_at",
          fields: SUGGEST_FIELDS,
        },
        next,
        cache: "force-cache",
      })
      .then(({ products }) => products.map(toSuggestProduct))
      .catch(() => [])
  }

  return {
    products: products.map(toSuggestProduct),
    categories: matchedCategories,
    collections: matchedCollections,
    fallback,
  }
}
