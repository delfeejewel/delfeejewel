import { defineLink } from "@medusajs/framework/utils"
import CustomerModule from "@medusajs/medusa/customer"
import AppointmentModule from "../modules/appointment"

/**
 * Read-only link: appointment.customer_id -> customer. Lets a logged-in
 * customer's bookings be queried alongside their account. Guests book with a
 * null customer_id (no link row).
 */
export default defineLink(
  {
    linkable: AppointmentModule.linkable.appointment as any,
    field: "customer_id",
  },
  CustomerModule.linkable.customer,
  { readOnly: true }
)
