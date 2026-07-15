import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"

import { issueGiftCardsForOrder } from "../lib/issue-gift-cards"

/**
 * On order.placed: issue + email any purchased gift cards — but ONLY if the
 * order is already paid (prepaid/online capture). For unpaid COD orders,
 * issuance is deferred to delivery (see the Shiprocket hook), so a code is
 * never emailed before the money is in. Idempotent + payment-gated logic lives
 * in issueGiftCardsForOrder.
 */
export default async function giftCardPurchasedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  await issueGiftCardsForOrder(container, event.data.id)
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
