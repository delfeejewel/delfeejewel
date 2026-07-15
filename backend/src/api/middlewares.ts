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
import { codTokenAmount, getCodPolicy } from "../utils/cod"

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

/**
 * Enforce the COD upfront token at checkout. If the cart is being completed
 * with a Cash-on-Delivery payment session and policy requires an upfront token,
 * block completion unless a sufficient token was actually paid (stamped on the
 * cart by /store/cod-upfront/verify). Without this the whole anti-RTO token is
 * UI-only — a client could complete a COD cart having paid nothing.
 */
async function enforceCodUpfront(
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
        "total",
        "metadata",
        "payment_collection.payment_sessions.provider_id",
        "payment_collection.payment_sessions.status",
      ],
    })
    const cart = carts?.[0] as any
    if (!cart) return next()

    const sessions = cart.payment_collection?.payment_sessions || []
    const activeCod = sessions.some(
      (s: any) =>
        String(s.provider_id || "").toLowerCase().includes("cod") &&
        s.status !== "canceled" &&
        s.status !== "error"
    )
    if (!activeCod) return next()

    const expectedToken = codTokenAmount(Number(cart.total || 0), getCodPolicy())
    if (expectedToken <= 0) return next()

    const meta = (cart.metadata as any) || {}
    const paid = Number(meta.cod_upfront_amount || 0)
    if (!meta.cod_upfront_payment_id || paid < expectedToken) {
      return res.status(402).json({
        message: `A ₹${expectedToken} upfront payment is required to place this Cash-on-Delivery order.`,
        code: "cod_upfront_required",
        required: expectedToken,
      })
    }
    return next()
  } catch {
    // Fail CLOSED would block all COD checkouts on a transient error; but
    // failing open re-opens the bypass. Compromise: only let it through when we
    // genuinely couldn't evaluate (exception), which is rare, and log nothing
    // sensitive. The verify route + reconcile still guard the happy path.
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

/**
 * The backend root serves nothing — send visitors to the admin dashboard.
 * A bare "/" matcher (route file or middleware) is silently dropped by
 * Medusa's RoutesSorter (it splits the matcher into zero segments), so we
 * match "/*" and act only on the exact root path.
 */
async function redirectRootToAdmin(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (req.path === "/") {
    return res.redirect("/app")
  }
  return next()
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/*",
      method: ["GET"],
      middlewares: [redirectRootToAdmin],
    },
    {
      // Authenticate FIRST so requirePermission reliably sees
      // auth_context.actor_id. Without this the RBAC check failed OPEN on core
      // Medusa routes (order cancel, payment capture/refund, etc.) because
      // actor_id wasn't yet populated in the middleware phase.
      //
      // Mirror Medusa's own admin defaults: include "api-key" and
      // allowUnregistered. allowUnregistered lets invite-acceptance tokens (no
      // user actor yet) and api-key requests PASS THROUGH this layer — Medusa's
      // per-route auth still applies the correct policy (e.g. strict auth on
      // order routes, allowUnregistered on /admin/invites/accept). For a normal
      // registered admin, actor_id is populated so requirePermission enforces
      // by role; requirePermission already fails open (next()) when actor_id is
      // absent, so unregistered tokens aren't blocked here either — and the
      // sensitive custom routes additionally carry fail-CLOSED handler guards.
      matcher: "/admin/*",
      middlewares: [
        authenticate("user", ["session", "bearer", "api-key"], {
          allowUnregistered: true,
        }),
        requirePermission,
      ],
    },
    {
      matcher: "/store/carts/*/complete",
      method: ["POST"],
      middlewares: [
        enforceCodUpfront,
        enforceFirstOrderCoupons,
        recomputeGiftCardsBeforeComplete,
      ],
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
    // Self-service change-password: the handler verifies the current password
    // and needs req.auth_context.actor_id (the customer id).
    {
      matcher: "/store/customers/me/password",
      method: ["POST"],
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
