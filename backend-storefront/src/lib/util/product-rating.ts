/**
 * Placeholder star rating for listing cards.
 *
 * Listing queries don't carry review aggregates, so cards show an indicative
 * rating rather than a real one. (The product page shows the genuine average
 * and hides the row entirely until a product has an approved review.)
 *
 * Derived from the product id rather than randomised at render time: the same
 * product must show the same rating on every render, or it would flicker
 * between the server and client passes and trip a hydration mismatch.
 */

const MIN_RATING = 4.0
const MAX_RATING = 5.0
const STEP = 0.1

/** FNV-1a — small, dependency-free, and well spread for short strings. */
const hash = (value: string): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * A stable rating in [4.0, 5.0] for the given product id.
 */
export const productRating = (id?: string | null): number => {
  const steps = Math.round((MAX_RATING - MIN_RATING) / STEP) + 1
  const offset = id ? hash(id) % steps : steps - 1
  return Number((MIN_RATING + offset * STEP).toFixed(1))
}

/** How many of the five stars to fill for a rating. */
export const filledStars = (rating: number): number => Math.round(rating)
