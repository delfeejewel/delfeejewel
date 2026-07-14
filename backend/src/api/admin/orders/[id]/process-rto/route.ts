import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { processRtoRefund } from "../../../../../lib/process-rto-refund"
import { actorHasPermission } from "../../../../../lib/rbac"

/**
 * POST /admin/orders/:id/process-rto
 * Manual fallback to run the RTO refund + restock pipeline for an order.
 * Useful when Shiprocket misses the webhook or when an admin marks an order
 * as returned by hand. Idempotent.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  // Guarded here, not in middleware: requirePermission fails OPEN when it can't
  // resolve actor_id, and this endpoint moves real money.
  if (!(await actorHasPermission(req, "shipping.write"))) {
    return res.status(403).json({ message: "Forbidden" })
  }

  const orderId = req.params.id
  if (!orderId) {
    return res.status(400).json({ message: "order id is required" })
  }

  try {
    const result = await processRtoRefund(orderId, req.scope as any)
    return res.json(result)
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "RTO failed" })
  }
}
