/**
 * Field sets for `/store/products` queries.
 *
 * These live outside `products.ts` because that file is `"use server"`, which
 * may only export async functions.
 */

/**
 * What every listing needs: price, stock, variant metadata (the MRP shown
 * struck through), product-level metadata and tags.
 */
export const LIST_PRODUCT_FIELDS =
  "*variants.calculated_price,+variants.inventory_quantity,+variants.metadata,+metadata,+tags,"

/**
 * Listing fields plus per-variant image sets.
 *
 * Only the product page reads `variant.images` (for the gallery that swaps
 * when you pick a variant). Expanding it costs roughly 2s per request against
 * the full catalogue, so listings must not pay for it — pass this explicitly
 * as `queryParams.fields` where the gallery is actually used.
 */
export const PRODUCT_DETAIL_FIELDS = `${LIST_PRODUCT_FIELDS}*variants.images,`
