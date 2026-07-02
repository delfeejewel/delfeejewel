import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/fraud-review/:id
 * Returns the fraud-risk summary for a single order, for the order-detail
 * risk-badge widget. `status: "none"` means the order was never scored
 * (e.g. placed before the engine existed).
 *
 * Gated by `orders.write` (lib/rbac.ts) — same as the rest of /admin/fraud-review.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: [order] } = await query.graph({
    entity: "order",
    fields: ["id", "metadata"],
    filters: { id: req.params.id },
  })
  if (!order) {
    return res.status(404).json({ message: "Order not found." })
  }

  const m = ((order as any).metadata as any) || {}
  if (m.fraud_status === undefined && m.fraud_score === undefined) {
    return res.json({ status: "none" })
  }

  return res.json({
    order_id: req.params.id,
    status: m.fraud_status || "clear",
    score: Number(m.fraud_score ?? 0),
    band: m.fraud_band || "low",
    reasons: Array.isArray(m.fraud_reasons) ? m.fraud_reasons : [],
    checked_at: m.fraud_checked_at || null,
    cleared_at: m.fraud_cleared_at || null,
  })
}
