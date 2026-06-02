import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { computeProductVelocity } from "../../../../lib/product-velocity"

/**
 * GET /admin/products/velocity?days=30&limit=10
 * Returns top fast-movers and slow-movers over the window.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const days = Number(req.query.days) || 30
  const limit = Number(req.query.limit) || 10
  try {
    const result = await computeProductVelocity(req.scope as any, {
      days,
      limit,
    })
    return res.json(result)
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Failed" })
  }
}
