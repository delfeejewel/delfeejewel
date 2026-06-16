import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"

/**
 * Product CREATE form, "Organize" tab: hide the "Shipping profile" and
 * "Sales channels" fields for non-developer roles. This store has a single
 * shipping profile and a single sales channel that never change — Medusa fills
 * them with defaults automatically — so the fields are just confusing noise.
 *
 * Developers keep them (see role check below).
 *
 * Why a DOM observer instead of a widget on the create form: Medusa has no
 * `product.create` injection zone. But the create form is a RouteFocusModal
 * rendered OVER the products LIST route, so this widget (mounted on
 * `product.list.before`) stays mounted while the modal is open. A
 * MutationObserver then catches the modal — and the on-demand "Organize" tab —
 * as they mount. Everything is scoped to the create form's `#organize` section
 * and matched by the exact field `<label>` text, so nothing else is touched.
 * Mirrors the approach in hide-admin-cards.tsx (product details page).
 */

const HIDDEN_LABELS = ["shipping profile", "sales channels"]

const hideOrganizeFields = () => {
  const organize = document.getElementById("organize")
  if (!organize) return

  const labels = Array.from(organize.querySelectorAll<HTMLElement>("label"))
  for (const target of HIDDEN_LABELS) {
    const label = labels.find(
      (el) => el.textContent?.trim().toLowerCase() === target
    )
    // Hide the whole field block (label + input), not just the label.
    const block = label?.closest<HTMLElement>('div[class*="grid-cols"]')
    if (block) block.style.display = "none"
  }
}

const HideOrganizeFieldsWidget = () => {
  useEffect(() => {
    let observer: MutationObserver | null = null
    let cancelled = false

    fetch("/admin/users/me", { credentials: "include" })
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return
        const role = body?.user?.metadata?.role ?? "admin"
        if (role === "developer") return // developers keep everything

        hideOrganizeFields()
        // The create modal + its "Organize" tab mount on demand — keep watching.
        observer = new MutationObserver(() => hideOrganizeFields())
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

export default HideOrganizeFieldsWidget
