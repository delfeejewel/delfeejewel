import { model } from "@medusajs/framework/utils"

/**
 * A single saved product on a customer's wishlist.
 * customer_id + product_id are stored as plain references; the storefront
 * enriches product_ids with priced product data via the store API.
 */
const WishlistItem = model
  .define("wishlist_item", {
    id: model.id().primaryKey(),
    customer_id: model.text(),
    product_id: model.text(),
  })
  .indexes([
    {
      on: ["customer_id", "product_id"],
      unique: true,
    },
  ])

export default WishlistItem
