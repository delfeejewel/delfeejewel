import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { RETURN_REQUEST_MODULE } from "../../../../../modules/return_request"
import { processReturnRefund } from "../../../../../lib/process-return-refund"
import { restockReturnItems } from "../../../../../lib/restock-return-items"
import { actorHasPermission } from "../../../../../lib/rbac"

/**
 * POST /admin/return-requests/:id/mark-received
 * Admin confirms the parcel is back at the warehouse.
 *
 * Refund flow: status → received, then processReturnRefund (restock + refund + email + completed).
 * Exchange flow: status → received, restock only. Admin then calls
 *   /admin/return-requests/:id/create-replacement to ship the new variant.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!(await actorHasPermission(req, "returns.write"))) {
    return res.status(403).json({ message: "Access denied. Returns permission required." })
  }
  const id = req.params.id
  const returnModule: any = req.scope.resolve(RETURN_REQUEST_MODULE)

  const [rr] = await returnModule.listReturnRequests({ id })
  if (!rr) return res.status(404).json({ message: "Return request not found" })
  if (!["approved", "received"].includes(rr.status)) {
    return res
      .status(400)
      .json({ message: `Return must be approved before marking received.` })
  }

  // Only the first approved→received transition restocks. A repeated
  // mark-received (already "received") must NOT restock again, or inventory is
  // double-counted on an exchange.
  const firstReceive = rr.status !== "received"
  if (firstReceive) {
    await returnModule.updateReturnRequests([
      { id, status: "received", received_at: new Date().toISOString() },
    ])
  }

  if (rr.type === "exchange") {
    if (!firstReceive) {
      return res.json({
        ok: true,
        next: "awaiting_replacement",
        restocked: false,
        already_received: true,
      })
    }
    try {
      const restock = await restockReturnItems(id, req.scope as any)
      return res.json({
        ok: true,
        next: "awaiting_replacement",
        restocked: restock.restocked,
        restocked_count: restock.count,
      })
    } catch (e: any) {
      return res.status(500).json({ message: e?.message || "Restock failed" })
    }
  }

  try {
    // Only restock on the FIRST receive. If a prior attempt already restocked
    // but the refund failed (status stayed "received"), a retry must refund
    // without adjusting inventory a second time.
    const result = await processReturnRefund(id, req.scope as any, {
      restock: firstReceive,
    })
    return res.json({ ok: true, ...result })
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Process failed" })
  }
}
