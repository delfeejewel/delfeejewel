import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import EmailNotificationService from "../../../modules/email_notification/service"
import { saveContactSubmission } from "../../../utils/save-contact-submission"

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * POST /store/contact
 * Stores a Contact Us submission and notifies the team.
 *
 * This endpoint OWNS persistence: it writes `contact_submissions` over
 * Postgres (read in CMS → Forms → Submissions). Previously the storefront
 * inserted the row itself via the Supabase REST API using the anon key, which
 * returns 402 as soon as the project exceeds its free-tier quota — breaking the
 * contact form while the database itself was perfectly healthy.
 *
 * The response reports what actually happened, so the storefront can tell a
 * customer their message got through rather than guessing:
 *   { success, stored }   success = stored OR the notification email was queued
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

  const submission = {
    name: name.trim(),
    email: email.trim(),
    phone: phone?.trim() || null,
    subject: subject?.trim() || null,
    message: message.trim(),
  }

  const stored = await saveContactSubmission(submission)
  if (!stored) {
    logger.error(
      `Contact submission from ${submission.email} could not be stored; ` +
        `falling back to the notification email only.`
    )
  }

  // Await delivery so we can tell the customer the truth. If the row was NOT
  // stored, the email is the only copy of this message — a silent failure there
  // would lose it outright.
  let emailed = false
  try {
    await emailService.sendContactNotificationEmail({ to, ...submission })
    emailed = true
  } catch (err: any) {
    logger.error(`Contact notification email failed: ${err?.message}`)
  }

  if (!stored && !emailed) {
    return res
      .status(503)
      .json({ success: false, stored: false, message: "Could not record your message" })
  }

  return res.json({ success: true, stored })
}
