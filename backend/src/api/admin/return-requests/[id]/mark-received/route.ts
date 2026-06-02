import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { RETURN_REQUEST_MODULE } from "../../../../../modules/return_request"
import { processReturnRefund } from "../../../../../lib/process-return-refund"
import { restockReturnItems } from "../../../../../lib/restock-return-items"

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
  const id = req.params.id
  const returnModule: any = req.scope.resolve(RETURN_REQUEST_MODULE)

  const [rr] = await returnModule.listReturnRequests({ id })
  if (!rr) return res.status(404).json({ message: "Return request not found" })
  if (!["approved", "received"].includes(rr.status)) {
    return res
      .status(400)
      .json({ message: `Return must be approved before marking received.` })
  }

  if (rr.status !== "received") {
    await returnModule.updateReturnRequests([
      { id, status: "received", received_at: new Date().toISOString() },
    ])
  }

  if (rr.type === "exchange") {
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
    const result = await processReturnRefund(id, req.scope as any)
    return res.json({ ok: true, ...result })
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Process failed" })
  }
}
