import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"

/**
 * Best-effort cosmetic lockout: an "employee" (packing/dispatch) login only
 * needs the Packing page. Medusa's admin-sdk has no single "every page" zone,
 * so this is registered on the handful of top-level list pages an employee
 * could actually land on/navigate to and redirects them back to /app/packing.
 * NOT a security boundary — that's the server-side shipping.write permission
 * check (src/lib/rbac.ts), which applies regardless of what's visible here.
 *
 * Also hides the sidebar links for admin-only custom routes (each is a
 * `<NavLink to="...">` inside a `div.px-3` — see @medusajs/dashboard
 * nav-item.tsx). These links live in the persistent app-shell sidebar, which
 * never unmounts across client-side navigation, so hiding them once here
 * (fired from whichever list page the employee's session first lands on)
 * keeps them hidden even after the redirect above sends them to /app/packing.
 */
const HIDDEN_NAV_ROUTES = [
  "/app/email-campaigns",
  "/app/payment-review",
  "/app/product-import",
  "/app/fraud-review",
  "/app/appointments",
  "/app/newsletter",
  "/app/gift-cards",
  "/app/analytics",
  "/app/security",
  "/app/coupons",
  // Settings tab — built-in Medusa settings routes (same NavItem/div.px-3
  // wrapper is used on the settings sidebar, see settings-layout.tsx)
  "/app/settings/workflows",
  "/app/settings/secret-api-keys",
  "/app/settings/publishable-api-keys",
  "/app/settings/locations",
  "/app/settings/sales-channels",
  "/app/settings/refund-reasons",
  "/app/settings/return-reasons",
  "/app/settings/tax-regions",
  "/app/settings/regions",
  "/app/settings/users",
  "/app/settings/store",
]

const hideEmployeeNavLinks = () => {
  for (const route of HIDDEN_NAV_ROUTES) {
    const link = document.querySelector<HTMLAnchorElement>(
      `a[href="${route}"]`
    )
    const item = link?.closest<HTMLElement>("div.px-3")
    if (item) item.style.display = "none"
  }
}

const EmployeeNavRestrictWidget = () => {
  useEffect(() => {
    fetch("/admin/users/me", { credentials: "include" })
      .then((r) => r.json())
      .then((body) => {
        const role = body?.user?.metadata?.role
        if (role !== "employee") return

        hideEmployeeNavLinks()
        const observer = new MutationObserver(() => hideEmployeeNavLinks())
        observer.observe(document.body, { childList: true, subtree: true })

        if (!window.location.pathname.startsWith("/app/packing")) {
          window.location.href = "/app/packing"
        }
      })
      .catch(() => {
        /* on any error, leave the UI untouched */
      })
  }, [])

  return null
}

export const config = defineWidgetConfig({
  zone: [
    "order.list.before",
    "order.details.side.before",
    "product.list.before",
    "customer.list.before",
    "promotion.list.before",
  ],
})

export default EmployeeNavRestrictWidget
