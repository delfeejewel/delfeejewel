import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { GIFT_CARD_MODULE } from ".."

type Container = { resolve: (key: any) => any }

/**
 * Sum the amount a gift card is already committing to *other* still-open carts.
 *
 * The stored balance is only decremented when an order is placed
 * (subscribers/gift-card-redeemed.ts), so a credit line on another cart is a
 * live "hold" against the balance unless it's been consumed (its order was
 * placed) or its cart has already completed.
 */
export async function pendingHolds(
  container: Container,
  giftCardId: string,
  currentCartId: string
): Promise<number> {
  const cartModule: any = container.resolve(Modules.CART)
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)

  const lines = await cartModule.listCreditLines({
    reference: "gift_card",
    reference_id: giftCardId,
  })

  const others = (lines || []).filter(
    (cl: any) => cl.cart_id !== currentCartId && cl?.metadata?.consumed !== true
  )
  if (!others.length) return 0

  // Drop holds whose cart has already completed — those were reconciled
  // against the balance at order placement and must not double-count.
  const cartIds = [...new Set(others.map((cl: any) => cl.cart_id))]
  const { data: carts } = await query.graph({
    entity: "cart",
    filters: { id: cartIds },
    fields: ["id", "completed_at"],
  })
  const completed = new Set(
    (carts || []).filter((c: any) => c.completed_at).map((c: any) => c.id)
  )

  return others
    .filter((cl: any) => !completed.has(cl.cart_id))
    .reduce((sum: number, cl: any) => sum + Number(cl.amount || 0), 0)
}

/**
 * Re-clamp every gift-card hold on a cart so it never exceeds the card's
 * available balance OR the cart's outstanding amount due. Call this after the
 * cart changes (items/shipping/promotions) and authoritatively right before
 * the cart is completed.
 *
 * Without this, a hold recorded when the cart total was high stays stale after
 * the cart shrinks — Medusa subtracts the full credit line from the total
 * (it does not clamp), so the total can go negative and the card would be
 * over-redeemed. Holds that no longer fit are reduced; ones with no room left
 * are removed entirely. The stored balance is never touched here.
 */
export async function reconcileGiftCardHolds(
  container: Container,
  cartId: string
): Promise<void> {
  const cartModule: any = container.resolve(Modules.CART)
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const giftCardModule: any = container.resolve(GIFT_CARD_MODULE)

  const { data: carts } = await query.graph({
    entity: "cart",
    filters: { id: cartId },
    fields: [
      "id",
      "total",
      "completed_at",
      "credit_lines.id",
      "credit_lines.amount",
      "credit_lines.reference",
      "credit_lines.reference_id",
      "credit_lines.metadata",
      "credit_lines.created_at",
    ],
  })
  const cart = carts?.[0] as any
  if (!cart || cart.completed_at) return

  const giftLines = ((cart.credit_lines || []) as any[])
    .filter(
      (cl) => cl?.reference === "gift_card" && cl?.metadata?.consumed !== true
    )
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  if (!giftLines.length) return

  // cart.total already has all credit lines subtracted. Add the gift holds back
  // to recover the amount due before any gift card was applied.
  const sumGift = giftLines.reduce(
    (s: number, cl: any) => s + Number(cl.amount || 0),
    0
  )
  let remaining = Math.max(0, Number(cart.total || 0) + sumGift)

  const toDelete: string[] = []
  const toUpdate: Array<{ id: string; amount: number }> = []

  for (const cl of giftLines) {
    let correct = 0
    const [gc] = await giftCardModule.listGiftCards(
      { id: cl.reference_id },
      { take: 1 }
    )
    if (gc && gc.status === "active") {
      const holds = await pendingHolds(container, gc.id, cartId)
      const available = Number(gc.balance || 0) - holds
      correct = Math.max(0, Math.min(available, remaining))
    }

    if (correct <= 0) {
      toDelete.push(cl.id)
    } else if (correct !== Number(cl.amount || 0)) {
      toUpdate.push({ id: cl.id, amount: correct })
    }
    remaining -= correct
  }

  if (toDelete.length) await cartModule.deleteCreditLines(toDelete)
  if (toUpdate.length) await cartModule.updateCreditLines(toUpdate)
}
