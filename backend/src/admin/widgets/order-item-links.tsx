import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"

/**
 * Turns the item titles in the built-in order "Items" card into links to the
 * product, opening in a new tab.
 *
 * Medusa's order-detail item list is a built-in component with no render hook,
 * so — same pattern as hide-admin-cards / hide-order-dev-cards — the titles are
 * matched in the DOM and wrapped. Deliberately conservative: it only touches a
 * leaf element whose entire text is exactly a line-item title from THIS order,
 * skips anything already inside a link, and skips our own widgets (which link
 * their items themselves). If the markup changes upstream and nothing matches,
 * the widget quietly does nothing.
 */

type LineItem = {
  id?: string
  title?: string
  product_handle?: string | null
}

const LINKED_ATTR = "data-delfee-item-link"

const linkify = (titleToUrl: Map<string, string>) => {
  if (!titleToUrl.size) return

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>("div, span, p, td, h2, h3")
  )

  for (const el of candidates) {
    // Leaf nodes only — a wrapper whose text happens to equal the title would
    // otherwise get its children destroyed.
    if (el.children.length > 0) continue
    if (el.hasAttribute(LINKED_ATTR)) continue
    if (el.closest("a")) continue
    // Our own widgets already render proper links.
    if (el.closest("[data-delfee-widget]")) continue

    const text = el.textContent?.trim()
    if (!text) continue

    const url = titleToUrl.get(text)
    if (!url) continue

    const link = document.createElement("a")
    link.href = url
    link.target = "_blank"
    link.rel = "noreferrer"
    link.textContent = text
    link.style.textDecoration = "underline"
    link.style.textUnderlineOffset = "2px"
    link.style.color = "inherit"

    el.textContent = ""
    el.appendChild(link)
    el.setAttribute(LINKED_ATTR, "true")
  }
}

const OrderItemLinksWidget = ({
  data,
}: {
  data: { id?: string; items?: LineItem[] }
}) => {
  useEffect(() => {
    let observer: MutationObserver | null = null
    let cancelled = false

    // The storefront origin is a server env var, so it comes back with the
    // items rather than being guessed in the browser.
    fetch(`/admin/packing/orders/${data?.id}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body) return

        const titleToUrl = new Map<string, string>()
        for (const item of body.items || []) {
          // Service lines (gift wrap, COD fee) have no product page.
          if (item?.title && item?.product_url) {
            titleToUrl.set(String(item.title).trim(), item.product_url)
          }
        }
        if (!titleToUrl.size) return

        let running = false
        const apply = () => {
          // Our own writes retrigger the observer; the flag stops the loop.
          if (running) return
          running = true
          try {
            linkify(titleToUrl)
          } finally {
            running = false
          }
        }

        apply()
        observer = new MutationObserver(apply)
        observer.observe(document.body, { childList: true, subtree: true })
      })
      .catch(() => {
        /* on any error, leave the UI untouched */
      })

    return () => {
      cancelled = true
      observer?.disconnect()
    }
  }, [data])

  return null
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default OrderItemLinksWidget
