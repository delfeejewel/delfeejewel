import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Seeds a couple of demo promotion codes for testing the cart/checkout
 * coupon flow. Idempotent — re-running skips codes that already exist.
 *
 * Run with: npx medusa exec ./src/scripts/seed-promotions.ts
 */

const PROMOS = [
  {
    code: "TEST10",
    application_method: {
      type: "percentage" as const,
      value: 10,
      target_type: "order" as const,
      allocation: "across" as const,
    },
  },
  {
    code: "WELCOME20",
    application_method: {
      type: "percentage" as const,
      value: 20,
      target_type: "order" as const,
      allocation: "across" as const,
    },
  },
]

export default async function seedPromotions({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const promoModule: any = container.resolve(Modules.PROMOTION)

  for (const p of PROMOS) {
    try {
      const existing = await promoModule.listPromotions({ code: p.code })
      if (existing?.length) {
        logger.info(`Promo ${p.code} already exists — skipping`)
        continue
      }
      const created = await promoModule.createPromotions({
        code: p.code,
        type: "standard",
        status: "active",
        is_automatic: false,
        application_method: p.application_method,
      })
      const id = Array.isArray(created) ? created[0]?.id : (created as any)?.id
      logger.info(
        `Created promo: ${p.code} (${p.application_method.value}% off) — ${id}`
      )
    } catch (e: any) {
      logger.error(`Failed to create ${p.code}: ${e.message}`)
    }
  }
}
