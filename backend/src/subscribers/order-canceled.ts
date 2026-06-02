import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { convertToLocale } from "../utils/money"
import EmailNotificationService from "../modules/email_notification/service"

export default async function orderCanceledHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const emailService: EmailNotificationService = container.resolve(
    "email_notification"
  )

  try {
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "total",
        "items.*",
        "shipping_address.*",
      ],
      filters: { id: data.id },
    })

    if (!order) return

    await emailService.sendOrderEmail("order.canceled", {
      order_id: order.id,
      order_number: order.display_id ?? order.id,
      customer_name: order.shipping_address?.first_name || "Customer",
      customer_email: order.email ?? "",
      total: convertToLocale(order.total, order.currency_code),
      items: (order.items || []).map((item: any) => ({
        title: item.title,
        quantity: item.quantity,
        price: convertToLocale(item.unit_price * item.quantity, order.currency_code),
      })),
      brand_name: process.env.BRAND_NAME || "Aurum",
    })
  } catch (error: any) {
    logger.error(`Order canceled email failed: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
}
