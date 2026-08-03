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
 * Roles that should not see the Medusa-facing entries in the user dropdown
 * (bottom-left avatar menu): Documentation, Changelog, Shortcuts. Those point
 * at docs.medusajs.com / medusajs.com and at a keyboard-shortcuts modal for
 * pages these roles mostly can't reach — noise for a store operator. Profile
 * settings, Theme and Logout stay.
 */
export const USER_MENU_HIDDEN_ROLES = ["admin", "employee"]

/**
 * Hide Documentation / Changelog / Shortcuts from the user dropdown.
 *
 * The dropdown is a radix portal rendered on open and torn down on close, so
 * this runs from the same MutationObserver as everything else here rather than
 * once at boot. Documentation and Changelog are matched by their outbound href
 * (language-independent); Shortcuts is a plain menu item with no href, so it is
 * matched by label — fine because this admin ships English only (src/admin/i18n).
 *
 * Removing three items leaves the dashboard's separators stranded (two in a row,
 * or a trailing one), so collapse those afterwards. Cosmetic only.
 */
const USER_MENU_HIDDEN_HREFS = [
  "https://docs.medusajs.com",
  "https://medusajs.com/changelog/",
]

const hideUserMenuItems = () => {
  const menus = new Set<HTMLElement>()

  for (const href of USER_MENU_HIDDEN_HREFS) {
    for (const link of Array.from(
      document.querySelectorAll<HTMLAnchorElement>(`a[href^="${href}"]`)
    )) {
      const menu = link.closest<HTMLElement>('[role="menu"]')
      if (!menu) continue
      const item = link.closest<HTMLElement>('[role="menuitem"]') || link
      item.style.display = "none"
      menus.add(menu)
    }
  }

  for (const menu of menus) {
    for (const item of Array.from(
      menu.querySelectorAll<HTMLElement>('[role="menuitem"]')
    )) {
      if ((item.textContent || "").trim() === "Shortcuts") {
        item.style.display = "none"
      }
    }

    // Collapse separators that no longer divide anything.
    let prevVisibleWasSeparator = true // leading separator is also redundant
    let lastVisible: HTMLElement | null = null

    for (const child of Array.from(menu.children) as HTMLElement[]) {
      if (child.style.display === "none") continue
      const isSeparator = child.getAttribute("role") === "separator"
      if (isSeparator && prevVisibleWasSeparator) {
        child.style.display = "none"
        continue
      }
      prevVisibleWasSeparator = isSeparator
      lastVisible = child
    }

    if (lastVisible?.getAttribute("role") === "separator") {
      lastVisible.style.display = "none"
    }
  }
}

/** The shortcut hint the dashboard hardcodes on the palette trigger. */
const SEARCH_SHORTCUT_HINT = "⌘K"

/**
 * Hide the sidebar search (⌘K) button.
 *
 * Unlike the entries above it is NOT a <NavLink>, so there is no href to match
 * on — it is a button that opens the command palette. The dashboard bundle is
 * minified past the point where class names are stable to target, so match on
 * structure instead.
 *
 * Match on the ⌘K hint, NOT on a <kbd> element: the dashboard renders that hint
 * as a plain <Text> (see Searchbar in @medusajs/dashboard shell), so the button
 * contains no <kbd> at all and its textContent is "Search⌘K" rather than
 * "Search". An earlier version of this required one or the other and therefore
 * never matched anything — the search box stayed visible for every role. The
 * hint is also language-independent, which the label is not.
 *
 * Cosmetic only — the ⌘K keyboard shortcut itself still works, since the
 * dashboard binds that on document.
 */
const setSearchHidden = (hidden: boolean) => {
  // Scope to buttons wrapped in the sidebar's div.px-3 so a search control on a
  // list page can't be caught by accident. Not scoped to a single <nav>: the
  // dashboard renders separate desktop and mobile sidebars.
  for (const el of Array.from(
    document.querySelectorAll<HTMLElement>("div.px-3 > button")
  )) {
    const label = (el.textContent || "").trim()
    if (!label.includes(SEARCH_SHORTCUT_HINT)) continue
    const wrapper = el.closest<HTMLElement>("div.px-3") || el
    wrapper.style.display = hidden ? "none" : ""
  }
}

const setNavLinksHidden = (routes: string[], hidden: boolean) => {
  for (const route of routes) {
    const link = document.querySelector<HTMLAnchorElement>(
      `a[href="${route}"]`
    )
    const item = link?.closest<HTMLElement>("div.px-3")
    if (item) item.style.display = hidden ? "none" : ""
  }
}

/**
 * Every route any role might have hidden — what we hide up front, before we
 * know who is logged in.
 */
const ALL_HIDEABLE_ROUTES = Array.from(
  new Set([
    ...HIDDEN_NAV_ROUTES,
    ...Object.values(ROLE_HIDDEN_NAV_ROUTES).flat(),
  ])
)

/** Where an employee gets sent when they land somewhere they shouldn't. */
const EMPLOYEE_HOME = "/app/packing"
/** …except inside Settings, where Profile is theirs and is the useful landing. */
const EMPLOYEE_SETTINGS_HOME = "/app/settings/profile"

/**
 * Bounce an employee off a page their sidebar doesn't offer.
 *
 * Hiding a nav link never stopped anyone reaching the URL, and one link routes
 * there on its own: "Settings" points at /app/settings, which the dashboard
 * redirects to /app/settings/store — a page in HIDDEN_NAV_ROUTES. So an
 * employee clicking Settings landed on Store settings every time.
 *
 * Employee only. For other roles the hidden list is cosmetic (one unused
 * built-in), and bouncing an admin to the packing screen would be worse than
 * the page they asked for. Still NOT a security boundary — the server-side
 * checks in src/lib/rbac.ts are; this just keeps the UI honest.
 */
const enforceRouteAccess = (routes: string[]) => {
  const path = window.location.pathname
  const blocked = routes.some((r) => path === r || path.startsWith(`${r}/`))
  if (!blocked) return

  const target = path.startsWith("/app/settings")
    ? EMPLOYEE_SETTINGS_HOME
    : EMPLOYEE_HOME
  if (path === target) return
  // replace(), not href: otherwise Back returns to the blocked page and bounces
  // again, trapping the tab.
  window.location.replace(target)
}

let started = false

/**
 * Hide first, ask afterwards.
 *
 * Two problems with resolving the role before hiding anything, both of which
 * an employee saw on every login:
 *
 *  1. The whole sidebar rendered unrestricted for as long as /admin/users/me
 *     took to answer — a visible flash of every extension route.
 *  2. Worse, this module is evaluated when the admin bundle first loads, which
 *     is on the LOGIN screen. There /admin/users/me 401s, so `body.user` was
 *     undefined and the role fell through to its "admin" default — installing
 *     admin's rules permanently, since the guard then marked itself started.
 *     Logging in is a client-side transition, not a page load, so an employee
 *     kept admin's sidebar until they manually refreshed.
 *
 * So: hide the union of everything hideable immediately, then resolve the role
 * and REVEAL whatever that role is allowed to see. A privileged user sees a
 * couple of nav items appear a moment late; nobody sees items they shouldn't.
 * An unauthenticated probe is no longer mistaken for an answer — we keep
 * retrying until a session actually exists.
 */
export const startEmployeeNavGuard = () => {
  if (started || typeof document === "undefined") return
  started = true

  let routes = ALL_HIDEABLE_ROUTES
  let hideSearch = true
  let hideUserMenu = false
  let enforceRoutes = false
  let resolved = false

  const apply = () => {
    setNavLinksHidden(routes, true)
    setSearchHidden(hideSearch)
    if (hideUserMenu) hideUserMenuItems()
    // Only once the role is known — until then `routes` is the union of every
    // hideable path, which would bounce a developer off their own pages.
    if (enforceRoutes) enforceRouteAccess(routes)
  }

  apply()
  new MutationObserver(apply).observe(document.body, {
    childList: true,
    subtree: true,
  })

  /** Returns false while nobody is signed in yet, so the caller can retry. */
  const resolveRole = async (): Promise<boolean> => {
    if (resolved) return true
    try {
      const res = await fetch("/admin/users/me", { credentials: "include" })
      if (!res.ok) return false
      const body = await res.json()
      const user = body?.user
      if (!user) return false

      // Mirrors getUserRole() in src/lib/rbac.ts, which defaults to "admin".
      const role = (user.metadata?.role as string) || "admin"
      const hidden = [
        ...(role === "employee" ? HIDDEN_NAV_ROUTES : []),
        ...(ROLE_HIDDEN_NAV_ROUTES[role] || []),
      ]

      resolved = true
      routes = hidden
      hideSearch = SEARCH_HIDDEN_ROLES.includes(role)
      hideUserMenu = USER_MENU_HIDDEN_ROLES.includes(role)
      enforceRoutes = role === "employee"

      setNavLinksHidden(
        ALL_HIDEABLE_ROUTES.filter((r) => !hidden.includes(r)),
        false
      )
      apply()
      return true
    } catch {
      return false
    }
  }

  void resolveRole().then((ok) => {
    if (ok) return
    // Still on the login screen. Keep everything hidden and keep asking; the
    // sign-in transition is client-side, so there is no load event to hook.
    const timer = window.setInterval(() => {
      void resolveRole().then((done) => {
        if (done) window.clearInterval(timer)
      })
    }, 2000)
  })
}
