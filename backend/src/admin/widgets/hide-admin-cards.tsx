import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"

/**
 * Hides built-in product UI that's noise for non-developer roles:
 *  - whole CARDS (Sales Channels, Shipping configuration)
 *  - Attribute fields MID code / HS code / Country of origin, BOTH in the
 *    Attributes card (read view) AND in the "Edit Attributes" drawer (form),
 *    since this store doesn't do international/customs shipping.
 *
 * Developers keep everything. These are built-in Medusa components with no
 * removal hook, so we hide them in the DOM by matching heading/label text.
 * Role = user.metadata.role (see /admin/set-role); current user from
 * /admin/users/me. The observer stays active for the page lifetime so the
 * edit drawer (which mounts on demand) is handled too.
 */

const HIDDEN_CARDS = ["sales channels", "shipping configuration"]
const HIDDEN_FIELDS = ["mid code", "hs code", "country of origin"]

// Hide the right container for a matched label/heading element:
// a read-view SectionRow (grid-cols-2) or a form field wrapper (has a control).
const hideContainerFor = (el: HTMLElement) => {
  const gridRow = el.closest<HTMLElement>('div[class*="grid-cols-2"]')
  if (gridRow) {
    gridRow.style.display = "none"
    return
  }
  let node: HTMLElement | null = el
  for (let i = 0; i < 5 && node; i++) {
    if (
      node.querySelector(
        "input, select, textarea, [role='combobox'], [aria-haspopup]"
      )
    ) {
      node.style.display = "none"
      return
    }
    node = node.parentElement
  }
}

const hideTargets = () => {
  // Whole cards (by heading)
  const headings = Array.from(
    document.querySelectorAll<HTMLElement>("h1, h2, h3, [role='heading']")
  )
  for (const target of HIDDEN_CARDS) {
    const heading = headings.find(
      (el) => el.textContent?.trim().toLowerCase() === target
    )
    const card =
      heading?.closest<HTMLElement>('div[class*="shadow-elevation-card"]') ??
      (heading?.parentElement?.parentElement as HTMLElement | null)
    if (card) card.style.display = "none"
  }

  // Attribute fields (read rows + edit-drawer fields) — hide ALL matches
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>("span, p, label, dt, div")
  )
  for (const target of HIDDEN_FIELDS) {
    nodes
      .filter((el) => el.textContent?.trim().toLowerCase() === target)
      .forEach(hideContainerFor)
  }
}

const HideAdminCardsWidget = () => {
  useEffect(() => {
    let observer: MutationObserver | null = null
    let cancelled = false

    fetch("/admin/users/me", { credentials: "include" })
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return
        const role = body?.user?.metadata?.role ?? "admin"
        if (role === "developer") return // developers keep everything

        hideTargets()
        // Keep observing so the on-demand "Edit Attributes" drawer is caught too
        observer = new MutationObserver(() => hideTargets())
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
  zone: "product.details.side.before",
})

export default HideAdminCardsWidget
