import { model } from "@medusajs/framework/utils"

/**
 * A message submitted through the storefront Contact Us form.
 */
const ContactMessage = model.define("contact_message", {
  id: model.id().primaryKey(),
  name: model.text(),
  email: model.text(),
  phone: model.text().nullable(),
  subject: model.text().nullable(),
  message: model.text(),
  status: model.enum(["new", "read", "archived"]).default("new"),
})

export default ContactMessage
