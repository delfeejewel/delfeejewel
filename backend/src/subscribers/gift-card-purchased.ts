import { randomBytes } from "crypto"

import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { GIFT_CARD_MODULE } from "../modules/gift_card"
import { convertToLocale } from "../utils/money"

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ" // no 0/O/1/I
const EXPIRY_DAYS = 365

function generateGiftCardCode(): string {
  const buf = randomBytes(12)
  let code = ""
  for (let i = 0; i < 12; i++) {
    code += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length]
  }
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`
}

/**
 * On order.placed: scan the order's items for any Gift Card variants
 * (variant or product metadata.is_gift_card === true), issue a unique
 * code per unit, persist a gift_card record, and email the recipient.
 *
 * The buyer-side PDP puts the recipient's email/name/message and the
 * purchaser's display name onto the cart line item's metadata, which
 * we read here.
 */
export default async function giftCardPurchasedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const giftCardModule: any = container.resolve(GIFT_CARD_MODULE)
  const emailService: any = container.resolve("email_notification")

  const orderId = event.data.id

  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: [
      "id",
      "display_id",
      "email",
      "customer_id",
      "currency_code",
      "items.id",
      "items.quantity",
      "items.unit_price",
      "items.metadata",
      "items.variant.metadata",
      "items.product.metadata",
    ],
  })

  const order = orders?.[0]
  if (!order) return

  const giftCardItems = ((order.items as any[]) || []).filter(
    (item) =>
      item?.variant?.metadata?.is_gift_card ||
      item?.product?.metadata?.is_gift_card
  )
  if (!giftCardItems.length) return

  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 86400_000)
  const expiresLabel = expiresAt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  let issued = 0

  for (const item of giftCardItems) {
    const value =
      Number(item.variant?.metadata?.gift_card_value) ||
      Number(item.unit_price) ||
      0
    if (!value) continue

    const meta = (item.metadata || {}) as any
    const recipientEmail = meta.recipient_email || order.email
    if (!recipientEmail) continue
    const recipientName = meta.recipient_name || null
    const purchaserName = meta.purchaser_name || null
    const message = meta.message || null

    for (let i = 0; i < Number(item.quantity || 1); i++) {
      const code = generateGiftCardCode()
      try {
        await giftCardModule.createGiftCards({
          code,
          value,
          balance: value,
          currency_code: order.currency_code,
          status: "active",
          expires_at: expiresAt,
          purchaser_order_id: order.id,
          purchaser_customer_id: order.customer_id || null,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          message,
        })

        await emailService.sendGiftCardEmail({
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          purchaser_name: purchaserName,
          code,
          value: convertToLocale(value, order.currency_code),
          expires_at: expiresLabel,
          message,
          brand_name: process.env.BRAND_NAME || "Delfee",
        })

        issued++
      } catch (e: any) {
        logger.error(
          `Failed to issue gift card for order #${order.display_id}: ${e.message}`
        )
      }
    }
  }

  logger.info(
    `Issued ${issued} gift card(s) for order #${order.display_id}`
  )
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
