import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { QR_CODE_MODULE } from "../../../modules/qr_code"

/**
 * GET /admin/qr-codes — list QR codes (optionally filtered by product_id).
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const qrModule: any = req.scope.resolve(QR_CODE_MODULE)
  const filters: any = {}
  if (req.query.product_id) filters.product_id = req.query.product_id
  if (req.query.status) filters.status = req.query.status

  const qrCodes = await qrModule.listQrCodes(filters)
  qrCodes.sort(
    (a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  return res.json({ qr_codes: qrCodes, count: qrCodes.length })
}
