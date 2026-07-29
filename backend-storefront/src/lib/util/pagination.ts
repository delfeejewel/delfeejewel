/**
 * Build the list of items a pagination control should render.
 *
 * Listing pages used to render EVERY page number, so a category with 85
 * products produced a row of 8+ buttons that wrapped on mobile — and it grows
 * with the catalogue. This keeps the control a fixed width: at most `windowSize`
 * consecutive numbers around the current page, always anchored by the first and
 * last page, with "…" wherever a run was skipped.
 *
 *   getPageItems(1, 8)  -> [1, 2, 3, "…", 8]
 *   getPageItems(5, 8)  -> [1, "…", 4, 5, 6, "…", 8]
 *   getPageItems(8, 8)  -> [1, "…", 6, 7, 8]
 *   getPageItems(3, 4)  -> [1, 2, 3, 4]      (no gap worth collapsing)
 *
 * An ellipsis is only emitted when it actually hides something: a gap of a
 * single page renders as that page, never as "…" standing in for one number.
 */
export type PageItem = number | "…"

export function getPageItems(
  current: number,
  total: number,
  windowSize = 3
): PageItem[] {
  if (total <= 1) return total === 1 ? [1] : []

  // Small enough to show in full — first/last are already part of the window.
  if (total <= windowSize + 2) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const half = Math.floor(windowSize / 2)
  let start = Math.max(2, current - half)
  let end = Math.min(total - 1, start + windowSize - 1)
  // Re-anchor when clamped at the end so the window keeps its full size.
  start = Math.max(2, end - windowSize + 1)

  const items: PageItem[] = [1]
  if (start > 2) items.push("…")
  for (let p = start; p <= end; p++) items.push(p)
  if (end < total - 1) items.push("…")
  items.push(total)
  return items
}
