import { defineLink } from "@medusajs/framework/utils"
import CustomerModule from "@medusajs/medusa/customer"
import GiftCardModule from "../modules/gift_card"

/**
 * Read-only link: gift_card.purchaser_customer_id -> customer.
 */
export default defineLink(
  {
    linkable: GiftCardModule.linkable.giftCard,
    field: "purchaser_customer_id",
  },
  CustomerModule.linkable.customer,
  { readOnly: true }
)
