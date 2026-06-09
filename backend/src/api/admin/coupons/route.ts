import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

const ERR = (res: MedusaResponse, status: number, message: string) =>
  res.status(status).json({ message })

const DEFAULT_CURRENCY = "inr"

/**
 * Flatten a promotion into the simple coupon shape the admin page renders.
 */
function toCoupon(p: any) {
  const am = p.application_method || {}
  const budget = p.campaign?.budget || null
  return {
    id: p.id,
    code: p.code,
    description: p.metadata?.description || null,
    first_order_only: p.metadata?.first_order_only === true,
    status: p.status,
    kind: am.type as "percentage" | "fixed", // percentage | fixed
    value: Number(am.value) || 0,
    target: am.target_type as string, // order | shipping_methods | items
    currency_code: am.currency_code || null,
    usage_limit: budget?.type === "usage" ? Number(budget.limit) || null : null,
    used: budget?.type === "usage" ? Number(budget.used) || 0 : null,
    ends_at: p.campaign?.ends_at || null,
    created_at: p.created_at,
  }
}

/**
 * GET /admin/coupons — list coupons (promotions) with their discount + limits.
 * Query: q (code search), offset, limit
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const promoModule: any = req.scope.resolve(Modules.PROMOTION)

  const q = (req.query.q as string)?.trim()
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0

  const filters: Record<string, any> = {}
  if (q) filters.code = { $ilike: `%${q.toUpperCase()}%` }

  const [promotions, count] = await promoModule.listAndCountPromotions(filters, {
    take: limit,
    skip: offset,
    order: { created_at: "DESC" },
    relations: ["application_method", "campaign", "campaign.budget"],
  })

  return res.json({
    coupons: (promotions || []).map(toCoupon),
    count,
    offset,
    limit,
  })
}

/**
 * POST /admin/coupons — create a coupon code.
 *
 * Body: {
 *   code, kind: "percentage" | "fixed", value,
 *   target?: "order" | "shipping",      // default "order"
 *   usage_limit?: number,               // total redemptions cap
 *   ends_at?: string                    // ISO date; coupon expires after
 * }
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as {
    code?: string
    description?: string
    kind?: string
    value?: number
    target?: string
    currency_code?: string
    usage_limit?: number
    ends_at?: string | null
    first_order_only?: boolean
  }

  const code = body.code?.trim().toUpperCase()
  const description = body.description?.trim() || null
  const firstOrderOnly = body.first_order_only === true
  const kind = body.kind === "fixed" ? "fixed" : "percentage"
  const value = Number(body.value)
  const target = body.target === "shipping" ? "shipping_methods" : "order"

  if (!code) return ERR(res, 400, "A coupon code is required.")
  if (!value || value <= 0) return ERR(res, 400, "A positive discount value is required.")
  if (kind === "percentage" && value > 100) {
    return ERR(res, 400, "A percentage discount can't exceed 100.")
  }

  // Expiry, if given, must be a valid future timestamp.
  let endsAt: Date | null = null
  if (body.ends_at) {
    endsAt = new Date(body.ends_at)
    if (isNaN(endsAt.getTime())) {
      return ERR(res, 400, "Expiry date/time is invalid.")
    }
    if (endsAt.getTime() <= Date.now()) {
      return ERR(res, 400, "Expiry must be in the future.")
    }
  }

  const promoModule: any = req.scope.resolve(Modules.PROMOTION)

  // Reject duplicates so two coupons can't share a code.
  const existing = await promoModule.listPromotions({ code })
  if (existing?.length) {
    return ERR(res, 409, `A coupon with code "${code}" already exists.`)
  }

  const application_method: Record<string, any> = {
    type: kind,
    value,
    target_type: target,
    allocation: target === "shipping_methods" ? "each" : "across",
  }
  // Fixed-amount discounts must declare a currency.
  if (kind === "fixed") {
    application_method.currency_code = (body.currency_code || DEFAULT_CURRENCY).toLowerCase()
  }

  // A usage limit or expiry is modelled via an attached campaign.
  let campaign: Record<string, any> | undefined
  const usageLimit = Number(body.usage_limit)
  if ((usageLimit && usageLimit > 0) || endsAt) {
    campaign = {
      name: `Coupon ${code}`,
      campaign_identifier: `coupon-${code}-${Date.now()}`,
      ...(endsAt ? { ends_at: endsAt } : {}),
      ...(usageLimit && usageLimit > 0
        ? { budget: { type: "usage", limit: usageLimit } }
        : {}),
    }
  }

  const metadata: Record<string, any> = {}
  if (description) metadata.description = description
  if (firstOrderOnly) metadata.first_order_only = true

  const created = await promoModule.createPromotions({
    code,
    type: "standard",
    status: "active",
    is_automatic: false,
    application_method,
    ...(Object.keys(metadata).length ? { metadata } : {}),
    ...(campaign ? { campaign } : {}),
  })

  const promo = Array.isArray(created) ? created[0] : created
  return res.status(201).json({ coupon: toCoupon(promo) })
}
