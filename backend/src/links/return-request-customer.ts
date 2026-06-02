import { defineLink } from "@medusajs/framework/utils"
import CustomerModule from "@medusajs/medusa/customer"
import ReturnRequestModule from "../modules/return_request"

export default defineLink(
  {
    linkable: ReturnRequestModule.linkable.returnRequest as any,
    field: "customer_id",
  },
  CustomerModule.linkable.customer,
  { readOnly: true }
)
