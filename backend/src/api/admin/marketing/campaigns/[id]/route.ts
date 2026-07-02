import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { MARKETING_MODULE } from "../../../../../modules/marketing"

/** GET /admin/campaigns/:id */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const marketing: any = req.scope.resolve(MARKETING_MODULE)
  const campaign = await marketing.retrieveCampaign(req.params.id).catch(() => null)
  if (!campaign) return res.status(404).json({ message: "Campaign not found." })
  return res.json({ campaign })
}

/** POST /admin/campaigns/:id — update a draft (can't edit one that's sending/sent). */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const marketing: any = req.scope.resolve(MARKETING_MODULE)
  const campaign = await marketing.retrieveCampaign(req.params.id).catch(() => null)
  if (!campaign) return res.status(404).json({ message: "Campaign not found." })
  if (campaign.status === "sending" || campaign.status === "sent") {
    return res.status(409).json({ message: "A sent or sending campaign can't be edited." })
  }

  const b = (req.body || {}) as Record<string, any>
  const patch: Record<string, any> = { id: campaign.id }
  for (const k of ["name", "subject", "body_html"]) {
    if (typeof b[k] === "string") patch[k] = b[k].trim()
  }
  if (b.audience_type) patch.audience_type = b.audience_type
  if ("audience_segment" in b) {
    patch.audience_segment =
      patch.audience_type === "segment" || campaign.audience_type === "segment"
        ? b.audience_segment || null
        : null
  }

  const updated = await marketing.updateCampaigns(patch)
  return res.json({ campaign: Array.isArray(updated) ? updated[0] : updated })
}

/** DELETE /admin/campaigns/:id — only drafts/failed can be removed. */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const marketing: any = req.scope.resolve(MARKETING_MODULE)
  const campaign = await marketing.retrieveCampaign(req.params.id).catch(() => null)
  if (!campaign) return res.status(404).json({ message: "Campaign not found." })
  if (campaign.status === "sending") {
    return res.status(409).json({ message: "A sending campaign can't be deleted." })
  }
  await marketing.deleteCampaigns(campaign.id)
  return res.json({ id: campaign.id, deleted: true })
}
