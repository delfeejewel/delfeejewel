import { model } from "@medusajs/framework/utils"

const QrCode = model
  .define("qr_code", {
    id: model.id().primaryKey(),
    code: model.text(),
    variant_id: model.text(),
    product_id: model.text(),
    sku: model.text().nullable(),
    status: model.enum(["active", "void"]).default("active"),
  })
  .indexes([
    { on: ["code"], unique: true },
    { on: ["variant_id"] },
    { on: ["product_id"] },
  ])

export default QrCode
