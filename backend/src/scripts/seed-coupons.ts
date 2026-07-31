import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Seeds the store's live coupon codes: three interchangeable 15%-off codes,
 * one per hero banner, so each banner's redemptions can be told apart.
 *
 *   RAKHSA-era art   → RAKSHA
 *   "A Promise That Lasts Forever" → ETERNAL
 *   "Elegance You Can Wear Every Day" → EVERYDAY
 *
 * They are the same offer — a shopper who finds any one of them gets 15% off.
 * Only ONE may ever apply to a cart; stacking all three would be 45% off. That
 * is enforced server-side in the cart promotions guard, not here.
 *
 * Targeting: the client asked for a whole-order discount that does NOT apply to
 * Gift Wrap or the COD handling fee. A `target_type: "order"` promotion cannot
 * exclude a product — that is precisely what item targeting is for — so these
 * target items with the two service products excluded. For a cart of real
 * products the total is identical to an order-level 15%; the wrap and the COD
 * fee simply stay at full price.
 *
 * Idempotent: re-running updates an existing code in place rather than
 * duplicating it, so it is safe to run after changing the value or exclusions.
 *
 * Run: npx medusa exec ./src/scripts/seed-coupons.ts
 */

const CODES = ["RAKSHA", "ETERNAL", "EVERYDAY"] as const

const DISCOUNT_PERCENT = 15

/** Service products that must never be discounted. */
const EXCLUDED_HANDLES = ["gift-wrap", "cod-fee"]

const DESCRIPTION = "15% off your order"

export default async function seedCoupons({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const promoModule: any = container.resolve(Modules.PROMOTION)

  // Resolve the excluded products at runtime — hardcoding ids would silently
  // stop excluding them if either product is ever reseeded.
  const { data: excludedProducts } = await query.graph({
    entity: "product",
    filters: { handle: EXCLUDED_HANDLES },
    fields: ["id", "handle"],
  })

  const excludedIds = (excludedProducts as any[]).map((p) => p.id)
  const foundHandles = (excludedProducts as any[]).map((p) => p.handle)
  const missing = EXCLUDED_HANDLES.filter((h) => !foundHandles.includes(h))

  if (missing.length) {
    // Loud, because a missing exclusion means that product silently gets 15%
    // off — the exact outcome this script exists to prevent.
    logger.warn(
      `Excluded product(s) not found: ${missing.join(", ")}. ` +
        `They will NOT be excluded from the coupons. Seed them first ` +
        `(e.g. npx medusa exec ./src/scripts/seed-cod-fee-product.ts), then re-run this.`
    )
  }

  logger.info(
    `Excluding ${excludedIds.length} product(s) from the discount: ${
      foundHandles.join(", ") || "none"
    }`
  )

  const applicationMethod: Record<string, any> = {
    type: "percentage",
    value: DISCOUNT_PERCENT,
    target_type: "items",
    allocation: "across",
    ...(excludedIds.length
      ? {
          target_rules: [
            {
              // Medusa 2.13.1 rejects "nin" — the allowed operators are
              // gte/lte/gt/lt/eq/ne/in. "ne" with several values is the
              // supported way to express "none of these".
              attribute: "items.product.id",
              operator: "ne",
              values: excludedIds,
            },
          ],
        }
      : {}),
  }

  for (const code of CODES) {
    try {
      const [existing] = await promoModule.listPromotions(
        { code },
        { relations: ["application_method"] }
      )

      if (existing) {
        await promoModule.updatePromotions({
          id: existing.id,
          status: "active",
          is_automatic: false,
          metadata: { ...(existing.metadata || {}), description: DESCRIPTION },
          application_method: {
            id: existing.application_method?.id,
            ...applicationMethod,
          },
        })
        logger.info(`Updated coupon ${code} — ${DISCOUNT_PERCENT}% off`)
        continue
      }

      const created = await promoModule.createPromotions({
        code,
        type: "standard",
        status: "active",
        is_automatic: false,
        metadata: { description: DESCRIPTION },
        application_method: applicationMethod,
      })

      const id = Array.isArray(created) ? created[0]?.id : (created as any)?.id
      logger.info(`Created coupon ${code} — ${DISCOUNT_PERCENT}% off — ${id}`)
    } catch (e: any) {
      logger.error(`Failed to seed ${code}: ${e.message}`)
      throw e
    }
  }
}
