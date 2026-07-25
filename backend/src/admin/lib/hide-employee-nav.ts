/**
 * Sidebar links an "employee" (packing/dispatch) login should never see —
 * admin-only custom routes plus built-in Settings sub-routes. Each sidebar
 * entry is a `<NavLink to="...">` inside a `div.px-3` (see @medusajs/dashboard
 * nav-item.tsx / settings-layout.tsx, both use the same wrapper), so we match
 * by href and hide that wrapper.
 *
 * startEmployeeNavGuard() is called once at MODULE scope (not inside a React
 * effect) from employee-nav-restrict.tsx. The admin SDK bundles every
 * widget/route module into one JS bundle loaded on first /app boot, so this
 * runs on every page regardless of which route the employee actually lands
 * on or navigates to — a component-scoped effect would only run while that
 * component stayed mounted, missing: (a) full-page navigations (bookmark, or
 * the employee-nav-restrict redirect itself, which reloads the page), and
 * (b) built-in pages like /app/settings that carry none of our widget zones.
 * The observer is intentionally never disconnected — it needs to outlive any
 * single page's component lifecycle for the tab's whole session.
 */
export const HIDDEN_NAV_ROUTES = [
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

let started = false

export const startEmployeeNavGuard = () => {
  if (started || typeof document === "undefined") return
  started = true

  fetch("/admin/users/me", { credentials: "include" })
    .then((r) => r.json())
    .then((body) => {
      const role = body?.user?.metadata?.role
      if (role !== "employee") return

      hideEmployeeNavLinks()
      new MutationObserver(() => hideEmployeeNavLinks()).observe(
        document.body,
        { childList: true, subtree: true }
      )
    })
    .catch(() => {
      /* on any error, leave the UI untouched */
    })
}
