import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"

/**
 * Hides the built-in plain "Description" field for the `admin` role, now that
 * the WYSIWYG "Description (Rich Text)" card is the way to author it.
 * Developers keep the native field.
 *
 * Two places to hide:
 *  1. Read view on the product page — the "Description" SectionRow in the
 *     general card (label + value share a grid-cols-2 row).
 *  2. The "Edit"/"Edit General" drawer — the textarea under a "Description" label.
 *
 * Matched by LABEL text and hidden at the ROW container, mirroring
 * hide-admin-cards.tsx. An earlier version matched the description's *value*
 * and hid only that cell, which left the orphaned "Description" label behind.
 *
 * Our own rich-text card is titled "Description (Rich Text)", so the exact-match
 * on "description" never touches it; it is also guarded via [data-desc-editor].
 */

const TARGET = "description"

const isOurs = (el: HTMLElement) =>
  !!el.closest("[data-desc-editor]") || !!el.closest("[contenteditable]")

// Hide the right container for a matched label: a read-view SectionRow
// (grid-cols-2) or a form-field wrapper (one that owns a control).
const hideContainerFor = (el: HTMLElement) => {
  if (isOurs(el)) return

  const gridRow = el.closest<HTMLElement>('div[class*="grid-cols-2"]')
  if (gridRow && !isOurs(gridRow)) {
    gridRow.style.display = "none"
    return
  }

  let node: HTMLElement | null = el
  for (let i = 0; i < 5 && node; i++) {
    if (node.querySelector("textarea, input, [role='textbox']")) {
      if (!isOurs(node)) node.style.display = "none"
      return
    }
    node = node.parentElement
  }
}

const hideTargets = () => {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>("span, p, label, dt, div, h2, h3")
  )
  nodes
    .filter((el) => {
      // Exact text match only — "Description (Rich Text)" must not match.
      if (el.textContent?.replace(/\s+/g, " ").trim().toLowerCase() !== TARGET)
        return false
      // Leaf-ish nodes only, so we don't match a wrapper that happens to
      // contain the word and nuke half the page.
      return el.children.length === 0
    })
    .forEach(hideContainerFor)
}

const HideNativeDescriptionWidget = () => {
  useEffect(() => {
    let observer: MutationObserver | null = null
    let cancelled = false

    fetch("/admin/users/me", { credentials: "include" })
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return
        const role = body?.user?.metadata?.role ?? "admin"
        if (role === "developer") return // developers keep the native field
        hideTargets()
        // Keep observing: the edit drawer mounts on demand.
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
  zone: "product.details.before",
})

export default HideNativeDescriptionWidget
