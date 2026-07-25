import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"

/**
 * Hides built-in order-detail UI that's noise/confusing for non-developer
 * roles: the "Activity" timeline (side column — auto-generated from
 * order_change + payment lifecycle events, e.g. separate "Awaiting payment"
 * entries per payment session, which reads as confusing without the
 * underlying context), plus the raw "Metadata" and "JSON" debug cards (main
 * column). These are built-in Medusa components with no removal hook, so
 * hidden in the DOM by matching heading text — same pattern as
 * hide-admin-cards.tsx. Developers keep everything.
 */

const HIDDEN_CARDS = ["activity", "metadata", "json"]

const hideTargets = () => {
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
}

const HideOrderDevCardsWidget = () => {
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
  zone: "order.details.side.before",
})

export default HideOrderDevCardsWidget
