import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"

// Categories are a tiny, cheap-to-fetch payload that only changes via admin
// edits. Skip the fetch cache entirely rather than tune a revalidate window —
// always-fresh has no meaningful cost here, and it's one less place stale
// admin edits (deleted/renamed categories) could linger in nav/homepage.
export const listCategories = async (query?: Record<string, any>) => {
  const limit = query?.limit || 100

  return sdk.client
    .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
      "/store/product-categories",
      {
        query: {
          fields:
            "*category_children, *products, *parent_category, *parent_category.parent_category",
          limit,
          // Store API doesn't default-sort by rank — without this, category
          // order (e.g. the homepage row) is arbitrary DB order, not the
          // admin-configured rank.
          order: "rank",
          ...query,
        },
        cache: "no-store",
      }
    )
    .then(({ product_categories }) => product_categories)
}

export const getCategoryByHandle = async (categoryHandle: string[]) => {
  const handle = `${categoryHandle.join("/")}`

  return sdk.client
    .fetch<HttpTypes.StoreProductCategoryListResponse>(
      `/store/product-categories`,
      {
        query: {
          fields: "*category_children, *products",
          handle,
        },
        cache: "no-store",
      }
    )
    .then(({ product_categories }) => product_categories[0])
}
