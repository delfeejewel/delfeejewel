import { HttpTypes } from "@medusajs/types"

/**
 * SKU-prefix → audience mapping.
 *
 * The catalogue encodes who a piece is for in the SKU prefix: the first letter
 * is the audience ("G" = Gents, "L" = Ladies) and the rest is the product type
 * (R = Ring, BR = Bracelet). So GR01 is a gents ring, LBR07 a ladies bracelet.
 *
 * This is a prefix ALLOWLIST rather than a "first letter" rule on purpose:
 * unrelated SKUs would otherwise be swept in (GIFT-WRAP-INR-50 is not a gents
 * product), and a large part of the catalogue uses type-only prefixes
 * (RING-*, EARR-*, NECK-*, BRAC-*, ANK-*, PEND-*, CS-*, NS-*, PS-*, NC-*,
 * RHK-*) that carry no audience at all. Those are deliberately unmapped: they
 * appear on the full /store listing but in neither audience view.
 *
 * To bring a prefix into an audience view, add it to the relevant array below —
 * nothing else needs to change. See docs/SKU-AUDIENCE-MAPPING.md for the list
 * of prefixes still awaiting a decision.
 */
export const AUDIENCE_SKU_PREFIXES = {
  men: ["GR", "GBR"],
  women: ["LR", "LBR"],
} as const

export type Audience = keyof typeof AUDIENCE_SKU_PREFIXES

export const AUDIENCES = Object.keys(AUDIENCE_SKU_PREFIXES) as Audience[]

/** Narrows an arbitrary query-string value to a known audience. */
export const parseAudience = (value?: string | null): Audience | undefined => {
  if (!value) return undefined
  const normalized = value.toLowerCase().trim()
  return (AUDIENCES as string[]).includes(normalized)
    ? (normalized as Audience)
    : undefined
}

const matchesPrefix = (sku: string, prefixes: readonly string[]) => {
  const upper = sku.trim().toUpperCase()
  return prefixes.some((prefix) => {
    if (!upper.startsWith(prefix)) return false
    // Guard against a longer prefix matching a shorter one's namespace:
    // "GR" must not claim "GRT12". The character after the prefix has to be a
    // digit or a separator, which is how every SKU in the catalogue is formed.
    const rest = upper.slice(prefix.length)
    return rest === "" || /^[0-9\-_]/.test(rest)
  })
}

/**
 * True when any of the product's variant SKUs belongs to `audience`.
 *
 * Requires `variants.sku` to have been requested — see
 * `AUDIENCE_PRODUCT_FIELDS` in `lib/data/product-fields`.
 */
export const productMatchesAudience = (
  product: HttpTypes.StoreProduct,
  audience: Audience
) => {
  const prefixes = AUDIENCE_SKU_PREFIXES[audience]
  return (product.variants || []).some(
    (variant) => variant.sku && matchesPrefix(variant.sku, prefixes)
  )
}

export const filterProductsByAudience = (
  products: HttpTypes.StoreProduct[],
  audience: Audience
) => products.filter((product) => productMatchesAudience(product, audience))
