import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Seeds a starter set of coupon codes for the storefront cart/checkout flow.
 * These all run on Medusa's built-in Promotion module — manage, edit, or add
 * more from the admin under "Promotions". Idempotent: re-running skips codes
 * that already exist.
 *
 * Run with: npx medusa exec ./src/scripts/seed-promotions.ts
 *
 * Seeded codes:
 *   TEST10     — 10% off the order (dev/testing)
 *   WELCOME20  — 20% off the order (dev/testing)
 *   FLAT200    — ₹200 off the order (fixed amount)
 *   FREESHIP   — free shipping (100% off shipping)
 *   SALE15     — 15% off, time-boxed campaign with a 500-use budget
 */

const DEFAULT_CURRENCY = "inr"

type PromoSeed = {
  code: string
  application_method: Record<string, any>
  campaign?: Record<string, any>
}

const PROMOS: PromoSeed[] = [
  {
    code: "TEST10",
    application_method: {
      type: "percentage",
      value: 10,
      target_type: "order",
      allocation: "across",
    },
  },
  {
    code: "WELCOME20",
    application_method: {
      type: "percentage",
      value: 20,
      target_type: "order",
      allocation: "across",
    },
  },
  {
    // Fixed-amount order discount. Fixed methods require a currency_code.
    code: "FLAT200",
    application_method: {
      type: "fixed",
      value: 200,
      currency_code: DEFAULT_CURRENCY,
      target_type: "order",
      allocation: "across",
    },
  },
  {
    // Free shipping: 100% off the shipping method(s) on the cart.
    code: "FREESHIP",
    application_method: {
      type: "percentage",
      value: 100,
      target_type: "shipping_methods",
      allocation: "each",
    },
  },
  {
    // Time-boxed sale, backed by a campaign that caps total redemptions at 500.
    // Adjust starts_at/ends_at or the budget from the admin as needed.
    code: "SALE15",
    application_method: {
      type: "percentage",
      value: 15,
      target_type: "order",
      allocation: "across",
    },
    campaign: {
      name: "Launch Sale",
      campaign_identifier: "launch-sale",
      starts_at: new Date(),
      ends_at: new Date(Date.now() + 30 * 86400_000),
      budget: { type: "usage", limit: 500 },
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
        ...(p.campaign ? { campaign: p.campaign } : {}),
      })
      const id = Array.isArray(created) ? created[0]?.id : (created as any)?.id
      const summary =
        p.application_method.type === "percentage"
          ? `${p.application_method.value}% off`
          : `${p.application_method.value} ${(p.application_method.currency_code || DEFAULT_CURRENCY).toUpperCase()} off`
      logger.info(`Created promo: ${p.code} (${summary}) — ${id}`)
    } catch (e: any) {
      logger.error(`Failed to create ${p.code}: ${e.message}`)
    }
  }
}
