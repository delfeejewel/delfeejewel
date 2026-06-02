"use client"

import { useEffect } from "react"

const STORAGE_KEY = "recently_viewed_products"
const MAX = 12

/**
 * Records the viewed product id in localStorage. Renders nothing.
 * Consumed by the /store recently-viewed strip.
 */
export default function RecentlyViewedTracker({
  productId,
}: {
  productId: string
}) {
  useEffect(() => {
    if (!productId) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const existing = raw ? (JSON.parse(raw) as string[]) : []
      const next = [productId, ...existing.filter((id) => id !== productId)]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, MAX)))
    } catch {
      // localStorage unavailable / quota exceeded — silently ignore
    }
  }, [productId])

  return null
}
