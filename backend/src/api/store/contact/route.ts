import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONTACT_MODULE } from "../../../modules/contact"
import type ContactModuleService from "../../../modules/contact/service"

/**
 * POST /store/contact
 * Public endpoint for the storefront Contact Us form. Stores the message.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { name, email, phone, subject, message } = (req.body ?? {}) as Record<
    string,
    string | undefined
  >

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res
      .status(400)
      .json({ message: "name, email and message are required" })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ message: "A valid email is required" })
  }

  const contactService: ContactModuleService = req.scope.resolve(CONTACT_MODULE)

  const created = await contactService.createContactMessages({
    name: name.trim().slice(0, 200),
    email: email.trim().slice(0, 200),
    phone: phone?.trim().slice(0, 50) || null,
    subject: subject?.trim().slice(0, 200) || null,
    message: message.trim().slice(0, 5000),
  })

  return res.status(201).json({ success: true, id: (created as any)?.id })
}
