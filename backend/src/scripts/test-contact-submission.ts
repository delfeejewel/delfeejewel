import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import EmailNotificationService from "../modules/email_notification/service"
import { saveContactSubmission } from "../utils/save-contact-submission"

/**
 * End-to-end check of the Contact Us pipeline, running the same two steps as
 * POST /store/contact: store the row over Postgres, then email the team.
 *
 *   npx medusa exec ./src/scripts/test-contact-submission.ts [from-email]
 *
 * Sends a REAL email to CONTACT_NOTIFICATION_EMAIL, so only run it against an
 * address you own. Use `--keep` to leave the row in contact_submissions;
 * by default the probe row is deleted again so the CMS inbox stays clean.
 */
export default async function testContactSubmission({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const selfIdx = process.argv.findIndex((a) =>
    a.endsWith("test-contact-submission.ts")
  )
  const args = selfIdx === -1 ? [] : process.argv.slice(selfIdx + 1)
  const keep = args.includes("--keep")
  const from =
    args.find((a) => a.includes("@")) || "deepanshu.bajaj@yopmail.com"

  const to =
    process.env.CONTACT_NOTIFICATION_EMAIL ||
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    "enquire@delfee.in"

  const submission = {
    name: "Deepanshu Bajaj",
    email: from,
    phone: "+91 98765 43210",
    subject: "General Enquiry",
    message:
      "This is an end-to-end test of the Contact Us form. If this email arrived, " +
      "storage and notification are both working.",
  }

  logger.info(`submitting as : ${submission.email}`)
  logger.info(`notifying     : ${to}`)

  const stored = await saveContactSubmission(submission)
  logger.info(stored ? "✅ stored in contact_submissions" : "❌ NOT stored")

  const emailService: EmailNotificationService =
    container.resolve("email_notification")

  let emailed = false
  try {
    await emailService.sendContactNotificationEmail({ to, ...submission })
    emailed = true
    logger.info(`✅ notification email sent to ${to}`)
  } catch (err: any) {
    logger.error(`❌ email failed: ${err?.message}`)
  }

  // Show what the CMS inbox would list.
  const { data } = await query.graph({
    entity: "contact_submission",
    fields: ["id"],
    pagination: { take: 1, skip: 0 },
  }).catch(() => ({ data: [] as any[] }))
  if (data?.length) logger.info(`contact_submissions reachable via query`)

  if (stored && !keep) {
    const { Pool } = await import("pg")
    const cs = process.env.DATABASE_URL!
    const pool = new Pool({
      connectionString: cs,
      max: 1,
      ssl: cs.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
    })
    const res = await pool.query(
      "DELETE FROM contact_submissions WHERE email = $1",
      [submission.email]
    )
    await pool.end()
    logger.info(`cleaned up ${res.rowCount} probe row(s) — pass --keep to retain`)
  }

  logger.info(
    stored && emailed
      ? "RESULT: contact pipeline fully working"
      : "RESULT: pipeline INCOMPLETE — see errors above"
  )
}
