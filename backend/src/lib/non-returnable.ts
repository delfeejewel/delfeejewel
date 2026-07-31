/**
 * Categories whose products can never be returned or exchanged.
 *
 * Coins are bullion-style goods priced off the live metal rate: accepting a
 * return days later means buying the metal back at a price that has moved,
 * which is why jewellers sell them final-sale. Keep this list in one place so
 * the store API, the admin and the storefront copy can't drift apart.
 */
export const NON_RETURNABLE_CATEGORY_HANDLES = ["coins"]

/**
 * Product ids that may not be returned.
 *
 * Resolved from the category rather than a per-product flag so that adding a
 * coin to the catalogue needs no extra step — being in the category is what
 * makes it final-sale.
 *
 * Throws nothing: on failure it returns an empty set, so callers must decide
 * their own fallback. For the store return route the safe direction is to let
 * the request through (a wrongly-blocked return is a support escalation; a
 * wrongly-allowed one is caught by the admin, who approves every return).
 */
export async function nonReturnableProductIds(query: any): Promise<Set<string>> {
  try {
    const { data } = await query.graph({
      entity: "product",
      filters: { categories: { handle: NON_RETURNABLE_CATEGORY_HANDLES } },
      fields: ["id"],
    })
    return new Set(((data as any[]) || []).map((p) => p.id))
  } catch {
    return new Set()
  }
}
