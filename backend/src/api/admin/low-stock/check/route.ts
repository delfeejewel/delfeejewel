import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { checkLowStock } from "../../../../lib/check-low-stock"

/**
 * POST /admin/low-stock/check
 * Manually run the low-stock sweep. Optional body: { threshold?, sendEmail? }.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const body = (req.body || {}) as {
    threshold?: number
    sendEmail?: boolean
  }
  try {
    const result = await checkLowStock(req.scope as any, body)
    return res.json(result)
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Failed" })
  }
}
