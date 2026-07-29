import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Attributes a promotion can be scoped by that make it *product specific*.
 * Maps the rule attribute onto the set of ids the product being viewed has,
 * so a coupon locked to "Rings" is never advertised on a bracelet page.
 */
const PRODUCT_SCOPE_ATTRIBUTES: Record<string, string> = {
  "items.product.id": "product_id",
  "items.product_category.id": "category_ids",
  "items.product_collection.id": "collection_ids",
  "items.product_tag.id": "tag_ids",
  "items.product_type.id": "type_ids",
}

const NEGATIVE_OPERATORS = new Set(["ne", "nin", "not_in"])

type ProductScope = Record<string, string[]>

const ruleValues = (rule: any): string[] =>
  (rule?.values || [])
    .map((v: any) => (typeof v === "string" ? v : v?.value))
    .filter(Boolean)

/**
 * Does this product satisfy the promotion's product-scoping rules?
 * Rules on attributes we don't understand are ignored (fail-open) — the real
 * enforcement always happens when the code is applied to the cart. This filter
 * only decides what's worth *advertising*.
 */
function matchesProduct(rules: any[], scope: ProductScope): boolean {
  for (const rule of rules || []) {
    const scopeKey = PRODUCT_SCOPE_ATTRIBUTES[rule?.attribute]
    if (!scopeKey) continue

    const values = ruleValues(rule)
    if (!values.length) continue

    const own = scope[scopeKey] || []
    const hit = own.some((id) => values.includes(id))

    if (NEGATIVE_OPERATORS.has(rule.operator)) {
      if (hit) return false
    } else if (!hit) {
      return false
    }
  }
  return true
}

/** Coupons restricted to specific customers/groups are private — never list them. */
const isCustomerTargeted = (rules: any[]): boolean =>
  (rules || []).some((r: any) => String(r?.attribute || "").startsWith("customer."))

/** A campaign that hasn't started, has ended, or has burnt its budget is dead. */
function campaignIsLive(campaign: any): boolean {
  if (!campaign) return true
  const now = Date.now()
  if (campaign.starts_at && new Date(campaign.starts_at).getTime() > now) return false
  if (campaign.ends_at && new Date(campaign.ends_at).getTime() <= now) return false

  const budget = campaign.budget
  if (budget?.type === "usage" && budget.limit != null) {
    if (Number(budget.used || 0) >= Number(budget.limit)) return false
  }
  return true
}

function toPublicCoupon(p: any) {
  const am = p.application_method || {}
  return {
    id: p.id,
    code: p.code,
    description: p.metadata?.description || null,
    kind: am.type as "percentage" | "fixed",
    value: Number(am.value) || 0,
    target: am.target_type as string, // order | items | shipping_methods
    currency_code: am.currency_code || null,
    first_order_only: p.metadata?.first_order_only === true,
    ends_at: p.campaign?.ends_at || null,
  }
}

/**
 * Collect the ids a product can be scoped by, so product-specific coupons can
 * be matched against the product currently being viewed.
 */
async function loadProductScope(
  scope: any,
  productId: string
): Promise<ProductScope | null> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    filters: { id: productId },
    fields: [
      "id",
      "type_id",
      "collection_id",
      "categories.id",
      "tags.id",
    ],
  })
  const product = data?.[0] as any
  if (!product) return null

  return {
    product_id: [product.id],
    collection_ids: product.collection_id ? [product.collection_id] : [],
    type_ids: product.type_id ? [product.type_id] : [],
    category_ids: (product.categories || []).map((c: any) => c.id),
    tag_ids: (product.tags || []).map((t: any) => t.id),
  }
}

/**
 * GET /store/promotions — the publicly advertisable coupon codes.
 *
 * Powers the "Offers & Coupons" section on the product page. Only lists codes
 * a shopper could actually type in themselves:
 *   - status active, manual (not automatic), standard type, has a code
 *   - campaign live (started, not ended, budget left)
 *   - not customer/group targeted (those are private offers)
 *   - not opted out via `metadata.hide_on_storefront`
 *   - product-scoped codes only when `product_id` matches the scope
 *
 * Query: product_id (optional), limit (default 6, max 20)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const productId = (req.query.product_id as string)?.trim()
  const limit = Math.min(Number(req.query.limit) || 6, 20)

  const promoModule: any = req.scope.resolve(Modules.PROMOTION)

  let scope: ProductScope | null = null
  if (productId) {
    try {
      scope = await loadProductScope(req.scope, productId)
      // Unknown product id — don't guess, just show the unscoped offers.
      if (!scope) scope = null
    } catch {
      scope = null
    }
  }

  let promotions: any[] = []
  try {
    promotions = await promoModule.listPromotions(
      { status: "active", is_automatic: false, type: "standard" },
      {
        take: 100,
        order: { created_at: "DESC" },
        relations: [
          "application_method",
          "application_method.target_rules",
          "application_method.target_rules.values",
          "rules",
          "rules.values",
          "campaign",
          "campaign.budget",
        ],
      }
    )
  } catch {
    // Never break the product page over the offers strip.
    return res.json({ coupons: [] })
  }

  const coupons = (promotions || [])
    .filter((p: any) => {
      if (!p?.code || !p.application_method?.value) return false
      if (p.metadata?.hide_on_storefront === true) return false
      if (!campaignIsLive(p.campaign)) return false
      if (isCustomerTargeted(p.rules)) return false
      if (scope) {
        if (!matchesProduct(p.rules, scope)) return false
        if (!matchesProduct(p.application_method?.target_rules, scope)) return false
      }
      return true
    })
    // Best-looking offers first: percentages by size, then fixed amounts.
    .sort((a: any, b: any) => {
      const aPct = a.application_method?.type === "percentage"
      const bPct = b.application_method?.type === "percentage"
      if (aPct !== bPct) return aPct ? -1 : 1
      return Number(b.application_method?.value) - Number(a.application_method?.value)
    })
    .slice(0, limit)
    .map(toPublicCoupon)

  return res.json({ coupons })
}
