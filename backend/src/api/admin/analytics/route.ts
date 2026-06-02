import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { computeAnalytics } from "../../../lib/analytics"

/**
 * GET /admin/analytics?days=30
 * Returns the KPI snapshot for the admin dashboard.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const days = Number(req.query.days) || 30
  try {
    const result = await computeAnalytics(req.scope as any, { days })
    return res.json(result)
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Failed" })
  }
}
