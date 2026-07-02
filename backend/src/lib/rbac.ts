import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export type Role = "developer" | "admin" | "ops" | "marketing" | "viewer"

export const ROLES: Role[] = ["developer", "admin", "ops", "marketing", "viewer"]

export const ROLE_LABELS: Record<Role, string> = {
  developer: "Developer",
  admin: "Admin",
  ops: "Operations",
  marketing: "Marketing",
  viewer: "Viewer (read-only)",
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
  [/^\/admin\/fraud-review/, "orders.write"],
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
