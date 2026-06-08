import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { convertToLocale } from "../utils/money"
import { signTrackToken } from "../utils/track-token"
import EmailNotificationService from "../modules/email_notification/service"

export default async function orderPlacedHandler({
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
        "tax_total",
        "discount_total",
        "metadata",
        "items.*",
        "items.product.handle",
        "shipping_address.*",
      ],
      filters: { id: data.id },
    })

    if (!order) return

    // Detect gift-wrap line item and flag the order so the ops widget +
    // warehouse staff know to apply branded packaging. Idempotent.
    const hasGiftWrap = ((order.items as any[]) || []).some(
      (it) => it?.product?.handle === "gift-wrap"
    )
    if (hasGiftWrap && !(order.metadata as any)?.gift_wrap) {
      try {
        const orderModule: any = container.resolve(Modules.ORDER)
        await orderModule.updateOrders([
          {
            id: order.id,
            metadata: { ...(order.metadata || {}), gift_wrap: true },
          },
        ])
      } catch (e: any) {
        logger.warn(`Could not flag gift_wrap on order ${order.id}: ${e?.message}`)
      }
    }

    const address = order.shipping_address
    const shippingStr = address
      ? `${address.first_name} ${address.last_name}, ${address.address_1}, ${address.city}, ${address.postal_code}`
      : undefined

    const cc = order.currency_code
    const subtotalNum = (order.items || []).reduce(
      (sum: number, it: any) =>
        sum + (Number(it.unit_price) || 0) * (it.quantity || 1),
      0
    )
    const discountNum = Number(order.discount_total) || 0
    const taxNum = Number(order.tax_total) || 0
    const totalNum = Number(order.total) || subtotalNum
    // Derive shipping so the breakdown always reconciles with the total.
    const shippingNum = Math.max(0, totalNum - subtotalNum - taxNum + discountNum)

    await emailService.sendOrderEmail("order.placed", {
      order_id: order.id,
      order_number: order.display_id ?? order.id,
      customer_name: address?.first_name || "Customer",
      customer_email: order.email ?? "",
      subtotal: convertToLocale(subtotalNum, cc),
      shipping: shippingNum > 0 ? convertToLocale(shippingNum, cc) : undefined,
      shipping_is_free: shippingNum === 0,
      discount: discountNum > 0 ? `−${convertToLocale(discountNum, cc)}` : undefined,
      total: convertToLocale(totalNum, cc),
      items: (order.items || []).map((item: any) => ({
        title: item.title,
        quantity: item.quantity,
        price: convertToLocale(item.unit_price * item.quantity, cc),
      })),
      shipping_address: shippingStr,
      track_token: order.email
        ? signTrackToken({ order_id: order.id, email: order.email })
        : undefined,
      brand_name: process.env.BRAND_NAME || "Delfee",
    })
  } catch (error: any) {
    logger.error(`Order placed email failed: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
