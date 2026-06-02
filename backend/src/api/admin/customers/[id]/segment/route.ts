import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { segmentFromOrderCount } from "../../../../../lib/segmentation"

/**
 * GET /admin/customers/:id/segment
 * Per-customer segment + supporting counts. Cheaper than computing the whole
 * segmentation table — pulls only this customer's orders.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params as { id: string }
  if (!id) return res.status(400).json({ message: "Missing customer id" })

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      filters: { customer_id: id } as any,
      fields: ["id", "total", "created_at", "canceled_at"],
    })

    let completed = 0
    let totalSpent = 0
    let lastOrderAt: string | null = null

    for (const o of (orders as any[]) || []) {
      if (o.canceled_at) continue
      completed += 1
      totalSpent += Number(o.total || 0)
      if (
        o.created_at &&
        (!lastOrderAt ||
          new Date(o.created_at).getTime() > new Date(lastOrderAt).getTime())
      ) {
        lastOrderAt = o.created_at
      }
    }

    return res.json({
      customer_id: id,
      completed_order_count: completed,
      total_spent: totalSpent,
      last_order_at: lastOrderAt,
      segment: segmentFromOrderCount(completed),
    })
  } catch (e: any) {
    return res
      .status(500)
      .json({ message: e?.message || "Failed to compute segment" })
  }
}
