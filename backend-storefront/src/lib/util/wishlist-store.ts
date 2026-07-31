"use client"

import { getWishlistProductIds } from "@lib/data/wishlist"

/**
 * Shared client-side view of "which products are on my wishlist".
 *
 * Listing pages render dozens of cards, each of which needs to know whether its
 * product is already saved. Fetching per card would mean dozens of identical
 * requests, and threading the ids down from the server would mean touching
 * every listing parent (store, category, search). So the ids are fetched ONCE
 * per page load and shared here.
 *
 * Logged-out shoppers get an empty set — `getWishlistProductIds` already
 * returns [] without auth, so there is no failure path to handle.
 */

let idsPromise: Promise<Set<string>> | null = null
let ids: Set<string> = new Set()
const listeners = new Set<() => void>()

const notify = () => listeners.forEach((l) => l())

/** Fetch (once) and cache the wishlist ids. */
export function loadWishlistIds(): Promise<Set<string>> {
  if (!idsPromise) {
    idsPromise = getWishlistProductIds()
      .then((list) => {
        ids = new Set(list)
        notify()
        return ids
      })
      .catch(() => {
        // A wishlist that can't load is not worth breaking a listing over —
        // hearts simply render empty until the next page load.
        idsPromise = null
        return ids
      })
  }
  return idsPromise
}

export const isWishlisted = (productId: string) => ids.has(productId)

/** Optimistic local update; callers reconcile with the server themselves. */
export function setWishlisted(productId: string, saved: boolean) {
  if (saved) ids.add(productId)
  else ids.delete(productId)
  notify()
}

export function subscribeWishlist(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Drop the cache so the next reader refetches (e.g. after sign-in). */
export function resetWishlistCache() {
  idsPromise = null
  ids = new Set()
  notify()
}
