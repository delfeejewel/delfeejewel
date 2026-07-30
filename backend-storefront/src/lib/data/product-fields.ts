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

/**
 * The bare minimum needed to map the catalogue to SKUs.
 *
 * The Men/Women listings are derived from the variant SKU prefix (see
 * `lib/util/sku-audience`) and `/store/products` has no "starts with" filter,
 * so the whole catalogue has to be scanned. Deliberately omits
 * `variants.calculated_price`: price calculation is what makes a full-catalogue
 * fetch expensive (~9s vs ~1s for this field set), and the matching pass
 * doesn't need prices — only the ids it resolves to are then fetched with
 * `LIST_PRODUCT_FIELDS`.
 *
 * `handle` is required so `listProducts` can still drop hidden add-on products.
 */
export const SKU_INDEX_FIELDS = "id,handle,+variants.sku"
