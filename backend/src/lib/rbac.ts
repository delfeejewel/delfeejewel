import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export type Role = "developer" | "admin" | "ops" | "marketing" | "viewer" | "employee"

export const ROLES: Role[] = ["developer", "admin", "ops", "marketing", "viewer", "employee"]

export const ROLE_LABELS: Record<Role, string> = {
  developer: "Developer",
  admin: "Admin",
  ops: "Operations",
  marketing: "Marketing",
  viewer: "Viewer (read-only)",
  employee: "Employee (packing & dispatch)",
}

/**
 * Permission keys are coarse — they map to clusters of admin functionality
 * rather than individual routes. The middleware translates request paths to
 * permission keys via PATH_PERMISSIONS below.
 */
export type Permission =
  | "users.manage"
  | "users.write"
  | "products.write"
  | "orders.write"
  | "returns.write"
  | "promotions.write"
  | "giftcards.write"
  | "analytics.read"
  | "customers.read"
  | "inventory.write"
  | "shipping.write"
  | "settings.write"
  | "appointments.write"

const ALL_PERMISSIONS: Permission[] = [
  "users.manage",
  "users.write",
  "products.write",
  "orders.write",
  "returns.write",
  "promotions.write",
  "giftcards.write",
  "analytics.read",
  "customers.read",
  "inventory.write",
  "shipping.write",
  "settings.write",
  "appointments.write",
]

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  developer: ALL_PERMISSIONS,
  // Admin manages the store but NOT team members / user accounts.
  admin: ALL_PERMISSIONS.filter(
    (p) => p !== "users.manage" && p !== "users.write"
  ),
  ops: [
    "orders.write",
    "returns.write",
    "inventory.write",
    "shipping.write",
    "customers.read",
    "analytics.read",
    "appointments.write",
  ],
  marketing: [
    "promotions.write",
    "giftcards.write",
    "analytics.read",
    "customers.read",
  ],
  viewer: ["analytics.read", "customers.read"],
  // Warehouse employee: packing/dispatch — the Packing page and the Shiprocket
  // AWB/label actions it drives — plus the catalogue and full order handling.
  // Both write permissions are coarse: products.write also permits DELETING a
  // product, and orders.write covers refunds, payment capture and cancellation
  // (i.e. moving real money), not just viewing orders. Returns/exchanges are
  // deliberately NOT included — that's returns.write, held by ops.
  employee: ["shipping.write", "products.write", "orders.write"],
}

/**
 * Maps request path prefixes (under /admin) to the permission they require.
 * The first matching prefix wins. Paths not listed here are NOT gated by this
 * middleware — Medusa's built-in auth still applies.
 *
 * Keep this list short and intentional: gate the routes where role really
 * matters, leave catalogue/browse-only routes open to any authenticated admin.
 */
export const PATH_PERMISSIONS: Array<[RegExp, Permission]> = [
  [/^\/admin\/set-role/, "users.manage"],
  // Create/delete/update team members — developer only. GET (list, /me) is
  // softened (a .write perm is not enforced on reads), and /admin/users/me is
  // excluded so anyone can view/edit their own profile.
  [/^\/admin\/users(\/(?!me(\/|$))|$)/, "users.write"],
  [/^\/admin\/return-requests\/.+\/(approve|reject|mark-received|create-replacement)/, "returns.write"],
  [/^\/admin\/orders\/.+\/(refund|capture|cancel)/, "orders.write"],
  // Payment capture/refund live under /admin/payments/:id/* in Medusa v2.
  [/^\/admin\/payments\/.+\/(capture|refund)/, "orders.write"],
  [/^\/admin\/fraud-review/, "orders.write"],
  // Flagged (paid-but-no-order) carts: retry/dismiss touches payment state.
  [/^\/admin\/flagged-carts/, "orders.write"],
  // Shipping/dispatch: warehouse pick-pack stages, RTO processing, and Medusa's
  // own fulfilment endpoints on an order. "ops" holds shipping.write.
  [/^\/admin\/orders\/.+\/(pick-label|process-rto|fulfillments)/, "shipping.write"],
  [/^\/admin\/packing/, "shipping.write"],
  [/^\/admin\/products(\/|$)/, "products.write"],
  [/^\/admin\/categories\/.+\/cover-image/, "products.write"],
  [/^\/admin\/qr-codes/, "inventory.write"],
  [/^\/admin\/low-stock/, "inventory.write"],
  [/^\/admin\/gift-cards/, "giftcards.write"],
  [/^\/admin\/coupons/, "promotions.write"],
  [/^\/admin\/marketing/, "promotions.write"],
  [/^\/admin\/newsletter/, "promotions.write"],
  [/^\/admin\/appointments/, "appointments.write"],
  [/^\/admin\/analytics/, "analytics.read"],
  [/^\/admin\/customers\/segments/, "customers.read"],
]

/**
 * READ gating. PATH_PERMISSIONS above deliberately softens ".write" permissions
 * on GET, so listing most things is open to any authenticated admin — fine for
 * the catalogue, not fine for the team roster or anything holding a credential.
 * These paths require the permission on GET as well.
 *
 * Chosen to be safe for the roles that keep access (developer, admin — both
 * hold settings.write): every path here is reachable only from a Settings page,
 * so a 403 can't break a screen another role actually works on. Notably absent,
 * and deliberately so:
 *  - /admin/store — the sidebar Header throws on a failed store fetch, which
 *    would white-screen the whole admin. Its metadata is redacted instead, see
 *    redactStoreForLowPrivilege in api/middlewares.ts.
 *  - regions, sales-channels, shipping-options/profiles, stock-locations,
 *    payment-providers, refund/return-reasons — all read by ordinary product
 *    and order screens that ops and employees use.
 *
 * /admin/users/me is excluded: every role needs to read its own profile.
 */
export const READ_PATH_PERMISSIONS: Array<[RegExp, Permission]> = [
  // The team roster: names and email addresses of every admin account.
  [/^\/admin\/users(\/(?!me(\/|$))|$)/, "settings.write"],
  // Pending invites carry acceptance tokens — reading one is a route to an
  // account. Note the unauthenticated accept flow is unaffected: this only
  // applies once an actor is resolved.
  [/^\/admin\/invites(\/|$)/, "settings.write"],
  [/^\/admin\/api-keys(\/|$)/, "settings.write"],
  [/^\/admin\/workflows-executions(\/|$)/, "settings.write"],
  [/^\/admin\/tax-regions(\/|$)/, "settings.write"],
  [/^\/admin\/tax-rates(\/|$)/, "settings.write"],
]

/** The permission a GET on `path` requires, or null if reads are open. */
export function readPermissionForPath(path: string): Permission | null {
  for (const [re, perm] of READ_PATH_PERMISSIONS) {
    if (re.test(path)) return perm
  }
  return null
}

export function permissionForPath(
  path: string,
  method: string
): Permission | null {
  // GET requests don't write — fall through unless the path is explicitly read-gated.
  const isWrite = method !== "GET" && method !== "HEAD" && method !== "OPTIONS"
  for (const [re, perm] of PATH_PERMISSIONS) {
    if (!re.test(path)) continue
    // Soften write-permissions on GET (e.g. listing products is fine for any admin)
    if (perm.endsWith(".write") && !isWrite) return null
    return perm
  }
  return null
}

export function roleHas(role: Role, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) || false
}

/**
 * Handler-level permission check. Use this inside a route handler (which only
 * runs AFTER admin auth, so auth_context.actor_id is reliably present) to gate
 * security-sensitive WRITES. The PATH_PERMISSIONS middleware fails OPEN on
 * routes that share a core prefix (e.g. /admin/products/*) because actor_id
 * isn't populated in the middleware phase there — so don't rely on it alone.
 *
 * Fails closed: a missing actor_id returns false (denied).
 */
export async function actorHasPermission(
  req: any,
  perm: Permission
): Promise<boolean> {
  const actorId = req?.auth_context?.actor_id
  if (!actorId) return false
  const role = await getUserRole(req.scope as MedusaContainer, actorId)
  return roleHas(role, perm)
}

/**
 * Resolve a user's role from their metadata. Defaults to "admin" for
 * back-compat with users created before RBAC existed.
 */
export async function getUserRole(
  container: MedusaContainer,
  userId: string
): Promise<Role> {
  const userModule: any = container.resolve(Modules.USER)
  const users = await userModule.listUsers({ id: userId })
  const u = users?.[0] as any
  const raw = (u?.metadata?.role as string) || "admin"
  return (ROLES.includes(raw as Role) ? raw : "admin") as Role
}
