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
  title?: string
  product_id?: string | null
  variant?: { product_id?: string | null } | null
}

const LINKED_ATTR = "data-delfee-item-link"

const linkify = (titleToProduct: Map<string, string>) => {
  if (!titleToProduct.size) return

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

    const productId = titleToProduct.get(text)
    if (!productId) continue

    const link = document.createElement("a")
    link.href = `/app/products/${productId}`
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

const OrderItemLinksWidget = ({ data }: { data: { items?: LineItem[] } }) => {
  useEffect(() => {
    const titleToProduct = new Map<string, string>()
    for (const item of data?.items || []) {
      const productId = item.product_id || item.variant?.product_id
      // Service lines (gift wrap, COD fee) carry no product — left as plain text.
      if (item.title && productId) titleToProduct.set(item.title.trim(), productId)
    }
    if (!titleToProduct.size) return

    let observer: MutationObserver | null = null
    let running = false

    const apply = () => {
      // Our own writes retrigger the observer; the flag keeps that from looping.
      if (running) return
      running = true
      try {
        linkify(titleToProduct)
      } finally {
        running = false
      }
    }

    apply()
    observer = new MutationObserver(apply)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer?.disconnect()
  }, [data])

  return null
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default OrderItemLinksWidget
