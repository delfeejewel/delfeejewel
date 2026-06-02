import { model } from "@medusajs/framework/utils"

const ReturnRequest: any = model
  .define("return_request", {
    id: model.id().primaryKey(),
    order_id: model.text(),
    customer_id: model.text(),
    type: model.enum(["refund", "exchange"]).default("refund"),
    status: model
      .enum([
        "pending",
        "approved",
        "rejected",
        "received",
        "completed",
        "canceled",
      ])
      .default("pending"),
    reason: model.text(),
    message: model.text().nullable(),
    rejected_reason: model.text().nullable(),
    refund_amount: model.number().nullable(),
    replacement_order_id: model.text().nullable(),
    currency_code: model.text(),
    approved_at: model.dateTime().nullable(),
    rejected_at: model.dateTime().nullable(),
    received_at: model.dateTime().nullable(),
    processed_at: model.dateTime().nullable(),
    items: model.hasMany(() => ReturnRequestItem),
  })
  .indexes([
    { on: ["customer_id"] },
    { on: ["order_id"] },
    { on: ["status"] },
    { on: ["type"] },
  ])

const ReturnRequestItem = model.define("return_request_item", {
  id: model.id().primaryKey(),
  line_item_id: model.text(),
  variant_id: model.text().nullable(),
  product_id: model.text().nullable(),
  title: model.text(),
  thumbnail: model.text().nullable(),
  quantity: model.number(),
  unit_price: model.number(),
  reason: model.text().nullable(),
  exchange_variant_id: model.text().nullable(),
  return_request: model.belongsTo(() => ReturnRequest, { mappedBy: "items" }),
})

export { ReturnRequest, ReturnRequestItem }
export default ReturnRequest
