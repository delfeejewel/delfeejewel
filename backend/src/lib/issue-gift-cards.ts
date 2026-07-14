import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { GIFT_CARD_MODULE } from "../modules/gift_card"
import { defaultExpiry, generateGiftCardCode } from "../modules/gift_card/lib/code"
import { convertToLocale } from "../utils/money"

function isOnlineProvider(providerId?: string | null): boolean {
  if (!providerId) return false
  const id = providerId.toLowerCase()
  return id.includes("razorpay") || id.includes("stripe")
}

/**
 * Is the order actually paid? A purchased gift card must never be issued (and
 * emailed as an ACTIVE, spendable code) before the money is in — otherwise a
 * COD buyer can place an order, receive the code, and refuse delivery.
 *
 * Paid means either:
 *  - the order carries a payment from an ONLINE provider (Razorpay). Such a
 *    payment record only exists once the session was successfully authorized,
 *    i.e. the customer genuinely paid online. We do NOT require `captured_at`
 *    here: in this app capture happens later (async webhook), so requiring it
 *    would leave prepaid gift cards NEVER issued. COD orders carry a `cod`
 *    provider payment, not an online one, so they don't match; OR
 *  - the order has been marked delivered (COD cash collected on delivery).
 */
function isOrderPaid(order: any): boolean {
  const payments = ((order.payment_collections as any[]) || []).flatMap(
    (pc) => pc?.payments || []
  )
  const onlinePaid = payments.some(
    (p: any) => isOnlineProvider(p?.provider_id) && Number(p?.amount) > 0
  )
  if (onlinePaid) return true
  const deliveredAt = (order.metadata as any)?.delivered_at
  return !!deliveredAt
}

/**
 * Issue + email one gift card per purchased unit, exactly once per order.
 *
 * Idempotent: stamps `order.metadata.gift_cards_issued` and bails if already
 * set, so a retried event or a second trigger (order.placed vs delivery) can't
 * double-issue. Safe to call from multiple triggers.
 */
export async function issueGiftCardsForOrder(
  container: any,
  orderId: string
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const giftCardModule: any = container.resolve(GIFT_CARD_MODULE)
  const orderModule: any = container.resolve("order")
  const emailService: any = container.resolve("email_notification")

  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: [
      "id",
      "display_id",
      "email",
      "customer_id",
      "currency_code",
      "metadata",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.amount",
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

  // Idempotency guard — mirrors the gift-card-redeemed subscriber.
  if ((order.metadata as any)?.gift_cards_issued) return

  const giftCardItems = ((order.items as any[]) || []).filter(
    (item) =>
      item?.variant?.metadata?.is_gift_card ||
      item?.product?.metadata?.is_gift_card
  )
  if (!giftCardItems.length) return

  // Never issue spendable codes before the order is paid.
  if (!isOrderPaid(order)) {
    logger.info(
      `Order #${order.display_id} has gift cards but isn't paid yet — deferring issuance until capture/delivery.`
    )
    return
  }

  // Claim issuance up front so a concurrent trigger bails (best-effort — the
  // check above already blocks the common retry case).
  try {
    await orderModule.updateOrders(order.id, {
      metadata: { ...(order.metadata || {}), gift_cards_issued: true },
    })
  } catch (e: any) {
    logger.error(
      `Could not stamp gift_cards_issued on order #${order.display_id}: ${e.message}`
    )
    return
  }

  const expiresAt = defaultExpiry()
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

  logger.info(`Issued ${issued} gift card(s) for order #${order.display_id}`)
}
