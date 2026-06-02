import { model } from "@medusajs/framework/utils"

const GiftCard = model
  .define("gift_card", {
    id: model.id().primaryKey(),
    code: model.text(),
    value: model.number(),
    balance: model.number(),
    currency_code: model.text(),
    status: model
      .enum(["active", "redeemed", "expired", "void"])
      .default("active"),
    expires_at: model.dateTime().nullable(),
    purchaser_order_id: model.text().nullable(),
    purchaser_customer_id: model.text().nullable(),
    recipient_email: model.text(),
    recipient_name: model.text().nullable(),
    message: model.text().nullable(),
  })
  .indexes([
    { on: ["code"], unique: true },
    { on: ["recipient_email"] },
    { on: ["status"] },
  ])

export default GiftCard
