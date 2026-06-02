import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import WishlistModule from "../modules/wishlist"

/**
 * Read-only link: wishlist_item.product_id -> product.
 * Uses the existing product_id column (no pivot table), enabling
 * single-query fetches of wishlist items with their product data.
 */
export default defineLink(
  {
    linkable: WishlistModule.linkable.wishlistItem,
    field: "product_id",
  },
  ProductModule.linkable.product,
  { readOnly: true }
)
