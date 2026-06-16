import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"

/**
 * Product CREATE form, "Variants" tab: hide confusing data-grid COLUMNS for
 * non-developer roles. This store only ever uses one currency (INR) and never
 * sells on backorder, so:
 *   - "Allow backorder"  → hidden (we want 0 stock = unavailable)
 *   - "Price India"      → hidden (region price; redundant — the INR currency
 *                          price already covers the India region)
 * Kept: Size, Title, SKU, Managed inventory, Has inventory kit (used by some
 * products), Price INR.
 *
 * Developers keep every column (see role check).
 *
 * Same constraints as hide-organize-fields.tsx: no `product.create` injection
 * zone, so this mounts on `product.list.before` (the create form is a
 * RouteFocusModal over the list) and a MutationObserver catches the grid.
 *
 * The grid (Medusa DataGrid) is column-virtualized with per-column widths, so
 * we can't just display:none individual cells. Instead we identify the target
 * column by its header text, read its `data-column-index`, and hide the header
 * + every body cell sharing that index — scoped to that grid's `[role=grid]`.
 * Header and body rows are flexbox, so the column collapses with no gap, and
 * hiding the same index in both keeps header/body aligned.
 */

const HIDDEN_COLUMN_HEADERS = ["allow backorder", "price india"]

const hideVariantColumns = () => {
  const grids = Array.from(
    document.querySelectorAll<HTMLElement>('[role="grid"]')
  )
  for (const grid of grids) {
    const headers = Array.from(
      grid.querySelectorAll<HTMLElement>('[role="columnheader"][data-column-index]')
    )
    for (const header of headers) {
      const text = header.textContent?.trim().toLowerCase() ?? ""
      const isTarget = HIDDEN_COLUMN_HEADERS.some(
        (h) => text === h || text.startsWith(h)
      )
      if (!isTarget) continue
      const idx = header.getAttribute("data-column-index")
      if (idx == null) continue
      grid
        .querySelectorAll<HTMLElement>(`[data-column-index="${idx}"]`)
        .forEach((cell) => {
          cell.style.display = "none"
        })
    }
  }
}

const HideVariantColumnsWidget = () => {
  useEffect(() => {
    let observer: MutationObserver | null = null
    let cancelled = false

    fetch("/admin/users/me", { credentials: "include" })
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return
        const role = body?.user?.metadata?.role ?? "admin"
        if (role === "developer") return // developers keep every column

        hideVariantColumns()
        // The Variants grid mounts on demand and re-renders on scroll
        // (column virtualization) — keep watching.
        observer = new MutationObserver(() => hideVariantColumns())
        observer.observe(document.body, { childList: true, subtree: true })
      })
      .catch(() => {
        /* on any error, leave the UI untouched */
      })

    return () => {
      cancelled = true
      observer?.disconnect()
    }
  }, [])

  return null
}

export const config = defineWidgetConfig({
  zone: "product.list.before",
})

export default HideVariantColumnsWidget
