import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import { wrapMarketingHtml } from "../../../../../../lib/marketing-email"
import { signUnsubscribeToken } from "../../../../../../utils/unsubscribe-token"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /admin/campaigns/:id/test  { email }
 * Sends the rendered campaign (with a working unsubscribe link) to one address
 * so the author can preview it. Surfaces the real send outcome.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const email = ((req.body as any)?.email || "").toLowerCase().trim()
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ message: "A valid test email is required." })
  }

  const marketing: any = req.scope.resolve(MARKETING_MODULE)
  const emailService: any = req.scope.resolve("email_notification")
  const campaign = await marketing.retrieveCampaign(req.params.id).catch(() => null)
  if (!campaign) return res.status(404).json({ message: "Campaign not found." })

  const unsubscribeUrl = `${
    process.env.MARKETING_PUBLIC_URL ||
    process.env.MEDUSA_BACKEND_URL ||
    "http://localhost:9000"
  }/newsletter/unsubscribe?token=${signUnsubscribeToken(email)}`

  const html = wrapMarketingHtml({ bodyHtml: campaign.body_html, unsubscribeUrl })
  const result = await emailService.sendCampaignEmail({
    to: email,
    subject: `[TEST] ${campaign.subject}`,
    html,
  })

  if (!result.ok) {
    return res.status(502).json({ message: result.error || "Test send failed." })
  }
  return res.json({ ok: true, message: `Test sent to ${email}` })
}
