import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { MARKETING_MODULE } from "../../../../modules/marketing"

const AUDIENCE_TYPES = ["subscribers", "segment", "all_customers", "everyone"]
const SEGMENTS = ["new", "repeat", "regular"]

/** GET /admin/campaigns — list campaigns, newest first. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const marketing: any = req.scope.resolve(MARKETING_MODULE)
  const campaigns = await marketing.listCampaigns(
    {},
    { order: { created_at: "DESC" }, take: 100 }
  )
  return res.json({ campaigns, count: campaigns.length })
}

/** POST /admin/campaigns — create a draft campaign. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const b = (req.body || {}) as Record<string, any>
  const name = (b.name || "").trim()
  const subject = (b.subject || "").trim()
  const body_html = (b.body_html || "").trim()
  const audience_type = b.audience_type || "subscribers"
  const audience_segment = b.audience_segment || null

  if (!name || !subject || !body_html) {
    return res
      .status(400)
      .json({ message: "Name, subject and body are required." })
  }
  if (!AUDIENCE_TYPES.includes(audience_type)) {
    return res.status(400).json({ message: "Invalid audience type." })
  }
  if (audience_type === "segment" && !SEGMENTS.includes(audience_segment)) {
    return res
      .status(400)
      .json({ message: "A segment (new/repeat/regular) is required for segment audiences." })
  }

  const marketing: any = req.scope.resolve(MARKETING_MODULE)
  const campaign = await marketing.createCampaigns({
    name,
    subject,
    body_html,
    audience_type,
    audience_segment: audience_type === "segment" ? audience_segment : null,
    status: "draft",
  })

  return res.status(201).json({ campaign })
}
