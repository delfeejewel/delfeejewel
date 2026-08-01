import { HttpTypes } from "@medusajs/types"

/**
 * Per-category navigation visibility.
 *
 * Each category can be shown or hidden independently on four surfaces, driven
 * by booleans on `product_category.metadata` and edited from the admin's
 * "Navigation visibility" widget.
 *
 * Semantics: a flag is opt-OUT. `undefined` means visible, so a category that
 * has never been touched (and every category created before this feature)
 * appears everywhere, exactly as it did before. Only an explicit `false` hides
 * it. Do not "normalise" missing flags to `false` anywhere.
 *
 * This is deliberately NOT the HIDDEN_CATEGORY_KEYS list in lib/data/categories
 * — that one hides a category from the storefront entirely, in one place, with
 * no per-surface control.
 */
export const CATEGORY_SURFACES = {
  header: "show_in_header",
  mobile: "show_in_mobile",
  footer: "show_in_footer",
  tiles: "show_in_tiles",
} as const

export type CategorySurface = keyof typeof CATEGORY_SURFACES

/** Human labels, used by the admin widget and kept next to the keys. */
export const CATEGORY_SURFACE_LABELS: Record<CategorySurface, string> = {
  header: "Header navigation",
  mobile: "Mobile menu",
  footer: "Footer navigation",
  tiles: "Category tiles (homepage & store page)",
}

type WithMetadata = { metadata?: Record<string, any> | null }

/**
 * `tiles` replaced the original single-purpose `hide_from_homepage` key. Old
 * rows are still honoured so nothing silently reappears on the homepage before
 * the migration script runs (Coins is the one category that used it).
 */
const legacyHiddenFromTiles = (c: WithMetadata) =>
  c.metadata?.hide_from_homepage === true

export const isVisibleIn = (c: WithMetadata, surface: CategorySurface) => {
  if (surface === "tiles" && legacyHiddenFromTiles(c)) {
    return false
  }
  return c.metadata?.[CATEGORY_SURFACES[surface]] !== false
}

/**
 * Tile surfaces render an image-led card, so a category with no cover image
 * would draw a grey "no image" placeholder. Requiring the image here means a
 * newly created category can never leak a broken-looking tile onto the
 * homepage — it simply appears once someone uploads a cover for it.
 *
 * The text-only surfaces (header/mobile/footer) have no such requirement.
 */
export const hasCoverImage = (c: WithMetadata) =>
  typeof c.metadata?.cover_image === "string" &&
  c.metadata.cover_image.trim() !== ""

/** Top-level, visible on `surface`, and (for tiles) actually has an image. */
export const visibleCategoriesFor = <
  T extends WithMetadata & { parent_category?: unknown }
>(
  categories: T[] | null | undefined,
  surface: CategorySurface
): T[] =>
  (categories || [])
    .filter((c) => !c.parent_category)
    .filter((c) => isVisibleIn(c, surface))
    .filter((c) => surface !== "tiles" || hasCoverImage(c))

export type StoreCategory = HttpTypes.StoreProductCategory
