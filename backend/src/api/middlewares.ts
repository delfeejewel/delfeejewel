import { defineMiddlewares } from "@medusajs/medusa"
import { authenticate } from "@medusajs/framework/http"
import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

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

/**
 * Enforce "first order only" coupons at checkout. If the cart carries a
 * promotion flagged `metadata.first_order_only` and the buyer already has an
 * order (matched by customer_id when logged in, or by email for guests),
 * block completion. Runs before the cart is completed.
 */
async function enforceFirstOrderCoupons(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const match = req.path.match(/\/store\/carts\/([^/]+)\/complete\/?$/)
    if (!match) return next()
    const cartId = match[1]

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: carts } = await query.graph({
      entity: "cart",
      filters: { id: cartId },
      fields: [
        "id",
        "email",
        "customer_id",
        "promotions.code",
        "promotions.metadata",
      ],
    })
    const cart = carts?.[0] as any
    if (!cart) return next()

    const firstOrderPromo = (cart.promotions || []).find(
      (p: any) => p?.metadata?.first_order_only === true
    )
    if (!firstOrderPromo) return next()

    // Has this buyer ordered before? Check account + guest email.
    const orFilters: any[] = []
    if (cart.customer_id) orFilters.push({ customer_id: cart.customer_id })
    if (cart.email) orFilters.push({ email: cart.email })
    if (!orFilters.length) return next()

    const { data: priorOrders } = await query.graph({
      entity: "order",
      filters: orFilters.length > 1 ? ({ $or: orFilters } as any) : orFilters[0],
      fields: ["id"],
      pagination: { take: 1 },
    })

    if ((priorOrders?.length || 0) > 0) {
      return res.status(409).json({
        message: `The code ${firstOrderPromo.code} is valid on your first order only. Please remove it to continue.`,
        code: "first_order_only",
      })
    }
    return next()
  } catch {
    // Never hard-block checkout on an internal error in this guard.
    return next()
  }
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

    // Developer only — managing users, invites, API keys and system/settings
    // routes requires the developer role. (No more "no role" bootstrap pass:
    // every real account now has an explicit role, so admins/ops/etc. are
    // blocked here.)
    if (role === "developer") return next()

    // Any other role (admin, ops, marketing, viewer) or no role — block.
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
      middlewares: [enforceFirstOrderCoupons, recomputeGiftCardsBeforeComplete],
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
