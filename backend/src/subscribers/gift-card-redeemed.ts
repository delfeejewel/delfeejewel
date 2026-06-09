import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { GIFT_CARD_MODULE } from "../modules/gift_card"

/**
 * On order.placed: reconcile any gift cards that were applied to the cart.
 *
 * Gift cards are applied as cart credit lines (holds) WITHOUT touching the
 * stored balance (see api/store/gift-cards/redeem). This is the single place
 * the balance is actually decremented, so an abandoned cart never strands
 * balance and a card can't be spent twice.
 *
 * Idempotent: guarded by an order metadata flag and by marking each consumed
 * credit line, so a replayed order.placed event won't double-decrement.
 */
export default async function giftCardRedeemedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const giftCardModule: any = container.resolve(GIFT_CARD_MODULE)
  const cartModule: any = container.resolve(Modules.CART)
  const orderModule: any = container.resolve(Modules.ORDER)

  const orderId = event.data.id

  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: ["id", "display_id", "metadata", "cart.id"],
  })
  const order = orders?.[0] as any
  if (!order) return

  const orderMeta = (order.metadata as any) || {}
  if (orderMeta.gift_cards_reconciled) return // already done

  const cartId = order.cart?.id
  if (!cartId) return

  const creditLines = await cartModule.listCreditLines({
    cart_id: cartId,
    reference: "gift_card",
  })
  const pending = (creditLines || []).filter(
    (cl: any) => cl?.metadata?.consumed !== true
  )
  if (!pending.length) {
    // Nothing to redeem — still stamp the flag so we don't re-scan on replay.
    await orderModule.updateOrders([
      { id: order.id, metadata: { ...orderMeta, gift_cards_reconciled: true } },
    ])
    return
  }

  // Sum the holds per gift card (a card could have a single line, but be safe).
  const byCard = new Map<string, number>()
  for (const cl of pending) {
    const id = cl.reference_id
    if (!id) continue
    byCard.set(id, (byCard.get(id) || 0) + Number(cl.amount || 0))
  }

  const redeemed: Array<{ id: string; amount: number }> = []

  for (const [giftCardId, amount] of byCard) {
    try {
      const [gc] = await giftCardModule.listGiftCards({ id: giftCardId }, { take: 1 })
      if (!gc) continue

      // Clamp: never redeem more than the card actually holds.
      const balance = Number(gc.balance) || 0
      const toDeduct = Math.min(amount, balance)
      const newBalance = Math.max(0, balance - toDeduct)

      await giftCardModule.updateGiftCards([
        {
          id: gc.id,
          balance: newBalance,
          status: newBalance <= 0 ? "redeemed" : gc.status,
        },
      ])
      redeemed.push({ id: gc.id, amount: toDeduct })
    } catch (e: any) {
      logger.error(
        `Failed to redeem gift card ${giftCardId} for order #${order.display_id}: ${e.message}`
      )
    }
  }

  // Mark the credit lines consumed so they don't count as live holds and
  // aren't reconciled again.
  try {
    await cartModule.updateCreditLines(
      pending.map((cl: any) => ({
        id: cl.id,
        metadata: { ...(cl.metadata || {}), consumed: true },
      }))
    )
  } catch (e: any) {
    logger.warn(
      `Could not mark gift-card credit lines consumed on order #${order.display_id}: ${e?.message}`
    )
  }

  await orderModule.updateOrders([
    {
      id: order.id,
      metadata: {
        ...orderMeta,
        gift_cards_reconciled: true,
        gift_cards_redeemed: redeemed,
      },
    },
  ])

  logger.info(
    `Redeemed ${redeemed.length} gift card(s) for order #${order.display_id}`
  )
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
