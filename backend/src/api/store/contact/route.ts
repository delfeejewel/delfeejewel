import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import EmailNotificationService from "../../../modules/email_notification/service"

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * POST /store/contact
 * Notifies the team of a new Contact Us submission.
 *
 * The submission itself is stored by the storefront directly in Supabase
 * (`contact_submissions`, managed in CMS → Forms). This endpoint only fires the
 * team-notification email, fire-and-forget — it never blocks the storefront.
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
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ message: "A valid email is required" })
  }

  const to =
    process.env.CONTACT_NOTIFICATION_EMAIL ||
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    "enquire@delfee.in"

  const emailService: EmailNotificationService =
    req.scope.resolve("email_notification")
  const logger = req.scope.resolve("logger")

  // Fire-and-forget: the message is already persisted in Supabase, so don't
  // hold the response on email delivery.
  emailService
    .sendContactNotificationEmail({
      to,
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || null,
      subject: subject?.trim() || null,
      message: message.trim(),
    })
    .catch((err: any) =>
      logger.error(`Contact notification email failed: ${err?.message}`)
    )

  return res.json({ success: true })
}
