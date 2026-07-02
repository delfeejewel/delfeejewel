import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import { sendCampaign } from "../../../../../../lib/send-campaign"

/**
 * POST /admin/campaigns/:id/send
 * Dispatches a draft/failed campaign. Flips it to `sending` synchronously to
 * close the double-click window, then runs the throttled send in the background
 * (fire-and-forget) so the request returns immediately.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const marketing: any = req.scope.resolve(MARKETING_MODULE)
  const campaign = await marketing.retrieveCampaign(req.params.id).catch(() => null)
  if (!campaign) return res.status(404).json({ message: "Campaign not found." })

  if (campaign.status === "sending") {
    return res.status(409).json({ message: "This campaign is already sending." })
  }
  if (campaign.status === "sent") {
    return res.status(409).json({ message: "This campaign has already been sent." })
  }

  // Close the double-click window before the async send picks it up.
  await marketing.updateCampaigns({ id: campaign.id, status: "sending" })

  // Fire-and-forget — the background sender owns the rest of the lifecycle.
  sendCampaign(req.scope, campaign.id).catch(() => {})

  return res.json({ status: "sending", id: campaign.id })
}
