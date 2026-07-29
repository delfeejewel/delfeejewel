import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"

// Categories are a tiny, cheap-to-fetch payload that only changes via admin
// edits. Skip the fetch cache entirely rather than tune a revalidate window —
// always-fresh has no meaningful cost here, and it's one less place stale
// admin edits (deleted/renamed categories) could linger in nav/homepage.
/**
 * Categories that must never appear anywhere the catalogue is listed — nav,
 * footer, homepage rows, search facets, category-page breadcrumbs.
 *
 * Filtered here, at the single source every listing goes through, rather than
 * per-component, so a new listing added later can't accidentally resurface
 * them. Matched case-insensitively on both name and handle.
 *
 * This hides them from the storefront; it does NOT delete the underlying
 * Medusa categories, so any products still assigned to them keep their data.
 */
const HIDDEN_CATEGORY_KEYS = ["collections", "gifting"]

const isHiddenCategory = (c: HttpTypes.StoreProductCategory) =>
  HIDDEN_CATEGORY_KEYS.includes((c.name || "").trim().toLowerCase()) ||
  HIDDEN_CATEGORY_KEYS.includes((c.handle || "").trim().toLowerCase())

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
    .then(({ product_categories }) =>
      (product_categories || [])
        .filter((c) => !isHiddenCategory(c))
        // Also strip them from children, so they can't reappear nested under
        // another category in dropdowns or breadcrumbs.
        .map((c) => ({
          ...c,
          category_children: (c.category_children || []).filter(
            (child) => !isHiddenCategory(child)
          ),
        }))
    )
}

export const getCategoryByHandle = async (categoryHandle: string[]) => {
  const handle = `${categoryHandle.join("/")}`

  return sdk.client
    .fetch<HttpTypes.StoreProductCategoryListResponse>(
      `/store/product-categories`,
      {
        query: {
          fields: "*category_children, *products, metadata",
          handle,
        },
        cache: "no-store",
      }
    )
    .then(({ product_categories }) => product_categories[0])
}
