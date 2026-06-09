import { defineMiddlewares } from "@medusajs/medusa"
import { authenticate } from "@medusajs/framework/http"
import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

import {
  getUserRole,
  permissionForPath,
  roleHas,
} from "../lib/rbac"
import { reconcileGiftCardHolds } from "../modules/gift_card/lib/holds"

/**
 * Custom RBAC Middleware
 * - Checks user metadata for role: "developer" | "admin"
 * - Blocks non-developer users from modifying system settings
 * - Separate from Medusa's built-in RBAC (MEDUSA_FF_RBAC), which is disabled
 */

const RESTRICTED_ROUTES = [
  "/admin/regions",
  "/admin/tax-regions",
  "/admin/tax-rates",
  "/admin/stock-locations",
  "/admin/sales-channels",
  "/admin/payment-providers",
  "/admin/shipping-options",
  "/admin/shipping-profiles",
  "/admin/store",
  "/admin/users",
  "/admin/invites",
  "/admin/api-keys",
]

/**
 * Coarse role-based permission check. Reads the user's role from metadata and
 * checks it against the path's required permission (lib/rbac.ts).
 * Routes that don't appear in PATH_PERMISSIONS pass through.
 */
async function requirePermission(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const actorId = (req as any).auth_context?.actor_id
    if (!actorId) return next()

    const perm = permissionForPath(req.path, req.method)
    if (!perm) return next()

    const role = await getUserRole(req.scope as any, actorId)
    if (!roleHas(role, perm)) {
      return res.status(403).json({
        message: `Your role (${role}) is not allowed to perform this action.`,
        required_permission: perm,
      })
    }
    return next()
  } catch {
    return next()
  }
}

/**
 * Right before a cart is completed, re-clamp any gift-card holds so the order
 * is created with correct totals (a hold left stale after the cart shrank
 * would otherwise over-redeem the card / drive the total negative). Runs on
 * the built-in POST /store/carts/:id/complete. Never blocks checkout — the
 * gift-card-redeemed subscriber clamps again as a backstop.
 */
async function recomputeGiftCardsBeforeComplete(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const match = req.path.match(/\/store\/carts\/([^/]+)\/complete\/?$/)
    if (match) {
      await reconcileGiftCardHolds(req.scope as any, match[1])
    }
  } catch {
    // Don't block order completion on a recompute failure.
  }
  return next()
}

async function requireDeveloper(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const actorId = (req as any).auth_context?.actor_id
    if (!actorId) return next()

    const userModule = req.scope.resolve(Modules.USER)
    const users = await userModule.listUsers({ id: actorId })
    const user = users?.[0] as any
    const role = user?.metadata?.role

    // Developer or no role set — allow
    if (role === "developer" || !role) return next()

    // Explicit non-developer role — block
    return res.status(403).json({
      message: "Access denied. This action requires developer privileges.",
    })
  } catch {
    return next()
  }
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/*",
      middlewares: [requirePermission],
    },
    {
      matcher: "/store/carts/*/complete",
      method: ["POST"],
      middlewares: [recomputeGiftCardsBeforeComplete],
    },
    ...RESTRICTED_ROUTES.map((route) => ({
      matcher: `${route}*`,
      method: ["POST", "DELETE"] as ("POST" | "DELETE")[],
      middlewares: [requireDeveloper],
    })),
    // Wishlist routes require an authenticated customer so the handler
    // can resolve req.auth_context.actor_id (the customer id).
    {
      matcher: "/store/customers/me/wishlist*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/customers/me/reviews*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/customers/me/return-requests*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    // Razorpay webhook: preserve the raw body so we can verify the HMAC
    // signature (Razorpay signs the exact bytes, not the parsed JSON).
    {
      matcher: "/hooks/razorpay",
      method: ["POST"],
      bodyParser: { preserveRawBody: true },
    },
  ],
})
