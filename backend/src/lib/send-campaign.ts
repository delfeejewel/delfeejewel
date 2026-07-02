import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { MARKETING_MODULE } from "../modules/marketing"
import { resolveRecipients } from "./marketing-audience"
import { wrapMarketingHtml } from "./marketing-email"
import { signUnsubscribeToken } from "../utils/unsubscribe-token"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Resend's default limit is ~2 req/s; ~600ms between sends keeps us safely under.
const DELAY_MS = Number(process.env.MARKETING_SEND_DELAY_MS) || 600

const PUBLIC_URL =
  process.env.MARKETING_PUBLIC_URL ||
  process.env.MEDUSA_BACKEND_URL ||
  "http://localhost:9000"

/**
 * Background processor for one campaign: resolve recipients, then send each
 * marketing email (throttled), updating sent/failed counts as it goes so the
 * admin can watch progress. Never throws to the caller — it's invoked
 * fire-and-forget from the send route; fatal errors land in campaign.last_error.
 *
 * Idempotency is the caller's job: only `draft`/`failed` campaigns should be
 * dispatched (so a re-trigger can't double-send a `sent` one).
 */
export async function sendCampaign(
  container: MedusaContainer,
  campaignId: string
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const marketing: any = container.resolve(MARKETING_MODULE)
  const emailService: any = container.resolve("email_notification")

  try {
    const [campaign] = await marketing.listCampaigns({ id: campaignId })
    if (!campaign) return

    const recipients = await resolveRecipients(container, campaign)

    await marketing.updateCampaigns({
      id: campaignId,
      status: "sending",
      total_recipients: recipients.length,
      sent_count: 0,
      failed_count: 0,
      last_error: null,
    })

    if (!recipients.length) {
      await marketing.updateCampaigns({
        id: campaignId,
        status: "sent",
        sent_at: new Date(),
        last_error: "No recipients matched this audience.",
      })
      logger.warn(`Campaign ${campaignId}: no recipients.`)
      return
    }

    let sent = 0
    let failed = 0
    let lastError: string | null = null

    for (const r of recipients) {
      const unsubscribeUrl = `${PUBLIC_URL}/newsletter/unsubscribe?token=${signUnsubscribeToken(r.email)}`
      const html = wrapMarketingHtml({
        bodyHtml: campaign.body_html,
        unsubscribeUrl,
      })
      const res = await emailService.sendCampaignEmail({
        to: r.email,
        subject: campaign.subject,
        html,
      })
      if (res.ok) sent++
      else {
        failed++
        lastError = res.error || "send failed"
      }

      // Persist progress periodically so the admin sees a live count.
      if ((sent + failed) % 25 === 0) {
        await marketing.updateCampaigns({
          id: campaignId,
          sent_count: sent,
          failed_count: failed,
        })
      }
      await sleep(DELAY_MS)
    }

    await marketing.updateCampaigns({
      id: campaignId,
      status: "sent",
      sent_count: sent,
      failed_count: failed,
      sent_at: new Date(),
      last_error: failed ? lastError : null,
    })
    logger.info(`Campaign ${campaignId} done: ${sent} sent, ${failed} failed.`)
  } catch (e: any) {
    logger.error(`Campaign ${campaignId} failed: ${e?.message}`)
    try {
      await marketing.updateCampaigns({
        id: campaignId,
        status: "failed",
        last_error: e?.message || "fatal error",
      })
    } catch {
      // best-effort
    }
  }
}
