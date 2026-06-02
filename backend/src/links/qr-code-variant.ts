import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import QrCodeModule from "../modules/qr_code"

export default defineLink(
  {
    linkable: QrCodeModule.linkable.qrCode,
    field: "variant_id",
  },
  ProductModule.linkable.productVariant,
  { readOnly: true }
)
