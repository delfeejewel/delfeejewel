import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import ReviewModule from "../modules/review"

/**
 * Read-only link: product_review.product_id -> product.
 * Uses the existing product_id column (no pivot table), so query.graph
 * can fetch a review together with its product in a single query.
 */
export default defineLink(
  {
    linkable: ReviewModule.linkable.productReview,
    field: "product_id",
  },
  ProductModule.linkable.product,
  { readOnly: true }
)
