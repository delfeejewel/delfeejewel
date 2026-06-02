import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { convertToLocale } from "../utils/money"
import EmailNotificationService from "../modules/email_notification/service"

/**
 * Sends review-request emails after an order is delivered.
 * Runs daily at 10 AM.
 *
 * An order qualifies when:
 *  - it has a delivered_at timestamp (set by the Shiprocket webhook),
 *  - delivery was between 1 and 7 days ago,
 *  - a review email hasn't already been sent (order metadata flag).
 */
export default async function reviewRequestJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderModule: any = container.resolve(Modules.ORDER)

  try {
    const emailService: EmailNotificationService =
      container.resolve("email_notification")

    const now = Date.now()
    const oneDayAgo = now - 1 * 86400_000
    const sevenDaysAgo = now - 7 * 86400_000
    const thirtyDaysAgo = new Date(now - 30 * 86400_000).toISOString()

    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "total",
        "items.title",
        "items.quantity",
        "items.unit_price",
        "shipping_address.first_name",
        "metadata",
      ],
      filters: { created_at: { $gte: thirtyDaysAgo } },
    })

    let sent = 0

    for (const order of orders || []) {
      const meta = (order.metadata as any) || {}

      if (meta.review_email_sent) continue
      if (!meta.delivered_at) continue
      if (!order.email) continue

      const deliveredTime = new Date(meta.delivered_at).getTime()
      if (deliveredTime > oneDayAgo) continue // delivered too recently
      if (deliveredTime < sevenDaysAgo) continue // delivered too long ago

      await emailService.sendOrderEmail("review.request", {
        order_id: order.id,
        order_number: order.display_id ?? order.id,
        customer_name:
          (order.shipping_address as any)?.first_name || "Customer",
        customer_email: order.email,
        total: convertToLocale(order.total, order.currency_code),
        items: ((order.items as any[]) || []).map((item) => ({
          title: item.title,
          quantity: item.quantity,
          price: convertToLocale(
            item.unit_price * item.quantity,
            order.currency_code
          ),
        })),
        brand_name: process.env.BRAND_NAME || "Delfee",
      })

      await orderModule.updateOrders(order.id, {
        metadata: {
          ...meta,
          review_email_sent: true,
          review_email_sent_at: new Date().toISOString(),
        },
      })

      logger.info(
        `Review request sent to ${order.email} for order #${order.display_id}`
      )
      sent++
    }

    logger.info(`Review request: sent ${sent} email(s)`)
  } catch (error: any) {
    logger.error(`Review request job failed: ${error.message}`)
  }
}

export const config = {
  name: "review-request",
  schedule: "0 10 * * *", // every day at 10 AM
}
