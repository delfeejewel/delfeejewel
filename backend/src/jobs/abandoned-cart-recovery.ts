import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { convertToLocale } from "../utils/money"
import EmailNotificationService from "../modules/email_notification/service"

/**
 * Identifies and emails customers about abandoned carts.
 * Runs hourly.
 *
 * A cart qualifies as "abandoned" when:
 *  - it has at least one item
 *  - it has an email (we can reach the customer)
 *  - no order has been placed from it
 *  - it was last updated between IDLE_MIN_HOURS and IDLE_MAX_HOURS ago
 *  - a recovery email hasn't already been sent (cart.metadata.recovery_sent_at)
 *
 * The min/max window prevents spamming carts the customer is actively editing
 * (too recent) and avoids dredging up dead carts from weeks ago.
 */
const IDLE_MIN_HOURS = Number(process.env.ABANDONED_CART_IDLE_MIN_HOURS) || 4
const IDLE_MAX_HOURS = Number(process.env.ABANDONED_CART_IDLE_MAX_HOURS) || 72

export default async function abandonedCartRecoveryJob(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const cartModule: any = container.resolve(Modules.CART)

  try {
    const emailService: EmailNotificationService =
      container.resolve("email_notification")

    const now = Date.now()
    const maxAgeIso = new Date(now - IDLE_MAX_HOURS * 3600_000).toISOString()
    const minAgeIso = new Date(now - IDLE_MIN_HOURS * 3600_000).toISOString()

    const { data: carts } = await query.graph({
      entity: "cart",
      filters: {
        updated_at: {
          $gte: maxAgeIso,
          $lte: minAgeIso,
        } as any,
      },
      fields: [
        "id",
        "email",
        "currency_code",
        "total",
        "updated_at",
        "completed_at",
        "metadata",
        "shipping_address.first_name",
        "items.id",
        "items.title",
        "items.variant_title",
        "items.quantity",
        "items.unit_price",
        "items.thumbnail",
      ],
    })

    const storefront =
      process.env.STOREFRONT_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:8000"
    const defaultRegion = process.env.NEXT_PUBLIC_DEFAULT_REGION || "in"

    let sent = 0
    for (const c of (carts as any[]) || []) {
      // Sanity filters that query.graph can't do cleanly
      if (c.completed_at) continue
      if (!c.email) continue
      if (!(c.items?.length > 0)) continue
      const meta = (c.metadata || {}) as any
      if (meta.recovery_sent_at) continue

      const items = (c.items as any[]).map((it) => ({
        title: it.title,
        variant_title: it.variant_title || null,
        quantity: Number(it.quantity || 0),
        unit_price: convertToLocale(
          Number(it.unit_price || 0),
          c.currency_code
        ),
        thumbnail: it.thumbnail || null,
      }))

      try {
        await emailService.sendAbandonedCartRecoveryEmail({
          customer_email: c.email,
          customer_name:
            (c.shipping_address as any)?.first_name || "there",
          cart_id: c.id,
          recover_url: `${storefront}/${defaultRegion}/cart/recover/${c.id}`,
          items,
          cart_total: convertToLocale(
            Number(c.total || 0),
            c.currency_code
          ),
          brand_name: process.env.BRAND_NAME || "Delfee",
        })

        await cartModule.updateCarts([
          {
            id: c.id,
            metadata: {
              ...meta,
              recovery_sent_at: new Date().toISOString(),
            },
          },
        ])
        sent += 1
      } catch (e: any) {
        logger.warn(
          `Abandoned cart ${c.id}: email failed (${e?.message || "unknown"})`
        )
      }
    }

    logger.info(`Abandoned cart recovery: sent ${sent} email(s)`)
  } catch (e: any) {
    logger.error(`Abandoned cart recovery job failed: ${e?.message}`)
  }
}

export const config = {
  name: "abandoned-cart-recovery",
  schedule: "0 * * * *", // every hour at :00
}
