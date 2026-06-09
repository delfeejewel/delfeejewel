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

const ALL_PERMISSIONS: Permission[] = [
  "users.manage",
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
]

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  developer: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter((p) => p !== "users.manage"),
  ops: [
    "orders.write",
    "returns.write",
    "inventory.write",
    "shipping.write",
    "customers.read",
    "analytics.read",
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
  [/^\/admin\/return-requests\/.+\/(approve|reject|mark-received|create-replacement)/, "returns.write"],
  [/^\/admin\/orders\/.+\/(refund|capture|cancel)/, "orders.write"],
  [/^\/admin\/products(\/|$)/, "products.write"],
  [/^\/admin\/categories\/.+\/cover-image/, "products.write"],
  [/^\/admin\/qr-codes/, "inventory.write"],
  [/^\/admin\/low-stock/, "inventory.write"],
  [/^\/admin\/gift-cards/, "giftcards.write"],
  [/^\/admin\/coupons/, "promotions.write"],
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
