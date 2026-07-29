/**
 * Role-based sidebar hiding. Despite the filename (kept to avoid churning the
 * import in employee-nav-restrict.tsx), this covers two cases: the broad
 * employee lockout in HIDDEN_NAV_ROUTES below, and per-role removals in
 * ROLE_HIDDEN_NAV_ROUTES further down.
 *
 * HIDDEN_NAV_ROUTES — sidebar links an "employee" (packing/dispatch) login
 * should never see —
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

/**
 * Routes hidden from roles OTHER than employee, keyed by role.
 *
 * Customer Groups is a built-in Medusa feature this store does not use — no
 * groups are defined, and nothing (promotions, price lists) is scoped by one.
 * It stays available to `developer` so it can be turned on deliberately later.
 * Cosmetic only, exactly like the employee list above: hiding a nav link is not
 * a permission check, and the route is still reachable by URL. If it ever needs
 * to be a real boundary, gate it in src/lib/rbac.ts.
 */
export const ROLE_HIDDEN_NAV_ROUTES: Record<string, string[]> = {
  admin: ["/app/customer-groups"],
  employee: ["/app/customer-groups"],
}

/** Roles that should not see the sidebar's ⌘K search trigger. */
export const SEARCH_HIDDEN_ROLES = ["admin", "employee"]

/**
 * Hide the sidebar search (⌘K) button.
 *
 * Unlike the entries above it is NOT a <NavLink>, so there is no href to match
 * on — it is a button that opens the command palette. The dashboard bundle is
 * minified past the point where class names are stable to target, so match on
 * structure instead: the only control in the sidebar carrying a <kbd> shortcut
 * hint next to the label "Search".
 *
 * Scoped to the sidebar (found via a nav link that always exists) so it cannot
 * accidentally hide a search box on a list page. Cosmetic only — the ⌘K
 * keyboard shortcut itself still works, since that is bound at the document
 * level by the dashboard.
 */
const hideSearchTrigger = () => {
  const anchor = document.querySelector<HTMLElement>('a[href="/app/orders"]')
  const sidebar = anchor?.closest<HTMLElement>("nav") || anchor?.parentElement?.parentElement
  const scope: ParentNode = sidebar || document

  for (const el of Array.from(scope.querySelectorAll<HTMLElement>("button"))) {
    const label = (el.textContent || "").trim()
    if (!label.startsWith("Search")) continue
    // The shortcut hint is what distinguishes the palette trigger from any
    // other button that happens to say "Search".
    if (!el.querySelector("kbd") && label !== "Search") continue
    const wrapper = el.closest<HTMLElement>("div.px-3") || el
    wrapper.style.display = "none"
  }
}

const hideNavLinks = (routes: string[]) => {
  for (const route of routes) {
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
      // Mirrors resolveRole() in src/lib/rbac.ts, which defaults to "admin".
      const role = (body?.user?.metadata?.role as string) || "admin"

      const routes = [
        ...(role === "employee" ? HIDDEN_NAV_ROUTES : []),
        ...(ROLE_HIDDEN_NAV_ROUTES[role] || []),
      ]
      const hideSearch = SEARCH_HIDDEN_ROLES.includes(role)
      if (!routes.length && !hideSearch) return

      const apply = () => {
        if (routes.length) hideNavLinks(routes)
        if (hideSearch) hideSearchTrigger()
      }

      apply()
      new MutationObserver(apply).observe(document.body, {
        childList: true,
        subtree: true,
      })
    })
    .catch(() => {
      /* on any error, leave the UI untouched */
    })
}
