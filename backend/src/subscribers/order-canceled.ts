import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { convertToLocale } from "../utils/money"
import EmailNotificationService from "../modules/email_notification/service"
import { GIFT_CARD_MODULE } from "../modules/gift_card"

export default async function orderCanceledHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const emailService: EmailNotificationService = container.resolve(
    "email_notification"
  )

  // Reverse any gift-card side effects of this order: give back balance the
  // order redeemed, and void cards the order issued (so a canceled purchase
  // can't leave a spendable code behind). Idempotent via order metadata flags.
  try {
    const giftCardModule: any = container.resolve(GIFT_CARD_MODULE)
    const orderModule: any = container.resolve(Modules.ORDER)

    const { data: [gcOrder] } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "metadata"],
      filters: { id: data.id },
    })
    if (gcOrder) {
      const meta = (gcOrder.metadata as any) || {}

      // 1. Restore balance this order redeemed.
      if (!meta.gift_cards_cancel_reversed && Array.isArray(meta.gift_cards_redeemed)) {
        for (const r of meta.gift_cards_redeemed as Array<{ id: string; amount: number }>) {
          try {
            const [gc] = await giftCardModule.listGiftCards({ id: r.id }, { take: 1 })
            if (!gc) continue
            const restored = Number(gc.balance || 0) + Number(r.amount || 0)
            await giftCardModule.updateGiftCards([
              {
                id: gc.id,
                balance: restored,
                status: gc.status === "redeemed" && restored > 0 ? "active" : gc.status,
              },
            ])
          } catch (e: any) {
            logger.error(`Restore gift-card ${r.id} on cancel failed: ${e.message}`)
          }
        }
      }

      // 2. Void cards this order issued (still active) — the purchase is void.
      if (!meta.gift_cards_cancel_reversed) {
        try {
          const issued = await giftCardModule.listGiftCards({
            purchaser_order_id: gcOrder.id,
          })
          const toVoid = (issued || []).filter((gc: any) => gc.status === "active")
          if (toVoid.length) {
            await giftCardModule.updateGiftCards(
              toVoid.map((gc: any) => ({ id: gc.id, status: "void", balance: 0 }))
            )
          }
        } catch (e: any) {
          logger.error(`Void issued gift cards on cancel failed: ${e.message}`)
        }
      }

      await orderModule.updateOrders([
        { id: gcOrder.id, metadata: { ...meta, gift_cards_cancel_reversed: true } },
      ])
    }
  } catch (error: any) {
    logger.error(`Gift-card reversal on cancel failed: ${error.message}`)
  }

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
      brand_name: process.env.BRAND_NAME || "Delfee",
    })
  } catch (error: any) {
    logger.error(`Order canceled email failed: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
}
