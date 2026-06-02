import { model } from "@medusajs/framework/utils"

/**
 * A verified-purchase product review.
 * order_id is the delivered order that proves the purchase.
 * One review per (customer, product) — enforced by the unique index.
 */
const ProductReview = model
  .define("product_review", {
    id: model.id().primaryKey(),
    customer_id: model.text(),
    customer_name: model.text(),
    product_id: model.text(),
    order_id: model.text(),
    rating: model.number(),
    content: model.text(),
    status: model
      .enum(["pending", "approved", "rejected"])
      .default("approved"),
  })
  .indexes([
    {
      on: ["customer_id", "product_id"],
      unique: true,
    },
    {
      on: ["product_id"],
    },
  ])

export default ProductReview
