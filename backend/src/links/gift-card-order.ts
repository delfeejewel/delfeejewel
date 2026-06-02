import { defineLink } from "@medusajs/framework/utils"
import OrderModule from "@medusajs/medusa/order"
import GiftCardModule from "../modules/gift_card"

/**
 * Read-only link: gift_card.purchaser_order_id -> order.
 * Uses the existing column so query.graph can join in one query.
 */
export default defineLink(
  {
    linkable: GiftCardModule.linkable.giftCard,
    field: "purchaser_order_id",
  },
  OrderModule.linkable.order,
  { readOnly: true }
)
