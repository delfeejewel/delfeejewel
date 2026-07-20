import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProduct } from "@medusajs/types"
import { useEffect } from "react"

/**
 * Hides the built-in (plain) product description for the "admin" role, now that
 * the WYSIWYG "Description (Rich Text)" editor is the way to author it.
 * Developers keep the native field.
 *
 * Two targets, both matched robustly (no reliance on Medusa's minified DOM):
 *  1. Read view on the product page — the text block whose content equals this
 *     product's description (we have it from `data.description`).
 *  2. Edit drawer — the form field whose <label> is "Description".
 *
 * Our own rich editor (marked with [data-desc-editor]) and any contentEditable
 * surface are always skipped. Role from /admin/users/me (metadata.role); the
 * observer stays active so the on-demand edit drawer is handled too.
 */

type DetailWidgetProps = { data: AdminProduct }

const norm = (s?: string | null) => (s || "").replace(/\s+/g, " ").trim()

const isOurs = (el: HTMLElement) =>
  !!el.closest("[data-desc-editor]") || !!el.closest("[contenteditable]")

const HideNativeDescriptionWidget = ({ data }: DetailWidgetProps) => {
  useEffect(() => {
    let observer: MutationObserver | null = null
    let cancelled = false
    const desc = norm(data.description as string | null)

    // Read view: hide the block whose text is exactly this description.
    const hideReadView = () => {
      if (!desc) return
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>("p, span, div")
      )
      for (const el of nodes) {
        if (isOurs(el)) continue
        if (el.querySelector("*")) continue // leaf text node only
        if (norm(el.textContent) !== desc) continue
        // walk up to the outermost wrapper that still holds only the
        // description (stops before the title/other siblings)
        let target: HTMLElement = el
        while (
          target.parentElement &&
          !isOurs(target.parentElement) &&
          norm(target.parentElement.textContent) === desc
        ) {
          target = target.parentElement
        }
        target.style.display = "none"
      }
    }

    // Edit drawer: hide the field wrapper for the <label>Description</label>.
    const hideEditField = () => {
      const labels = Array.from(document.querySelectorAll<HTMLElement>("label"))
      for (const l of labels) {
        if (norm(l.textContent) !== "Description") continue
        let node: HTMLElement | null = l
        for (let i = 0; i < 5 && node; i++) {
          if (node.querySelector("textarea, input, [contenteditable]")) {
            if (!isOurs(node)) node.style.display = "none"
            break
          }
          node = node.parentElement
        }
      }
    }

    const run = () => {
      hideReadView()
      hideEditField()
    }

    fetch("/admin/users/me", { credentials: "include" })
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return
        const role = body?.user?.metadata?.role ?? "admin"
        if (role === "developer") return // developers keep the native field
        run()
        observer = new MutationObserver(run)
        observer.observe(document.body, { childList: true, subtree: true })
      })
      .catch(() => {
        /* on any error, leave the UI untouched */
      })

    return () => {
      cancelled = true
      observer?.disconnect()
    }
  }, [data.id, data.description])

  return null
}

export const config = defineWidgetConfig({
  zone: "product.details.before",
})

export default HideNativeDescriptionWidget
