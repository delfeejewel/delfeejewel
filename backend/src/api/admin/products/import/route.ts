import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import {
  parseCsv,
  planImport,
  csvTemplate,
  TEMPLATE_HEADERS,
} from "../../../../lib/supplier-import"
import { actorHasPermission } from "../../../../lib/rbac"

/**
 * GET  /admin/products/import          → download the CSV template
 * POST /admin/products/import          → dry-run preview (no writes)
 *
 * RBAC: covered by the existing `^/admin/products` → products.write rule.
 * POST is a write (enforced); GET is softened (any admin may grab the template).
 */
export async function GET(_req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="product-import-template.csv"'
  )
  return res.send(csvTemplate())
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  // Handler-level RBAC: the PATH_PERMISSIONS middleware fails open under the
  // /admin/products core prefix, so gate the write here (fails closed).
  if (!(await actorHasPermission(req, "products.write"))) {
    return res
      .status(403)
      .json({ message: "Access denied. The Products permission is required to import." })
  }

  const csv = (req.body as any)?.csv
  if (typeof csv !== "string" || !csv.trim()) {
    return res
      .status(400)
      .json({ message: "Provide CSV text in the `csv` field." })
  }

  let rows: Record<string, string>[]
  try {
    rows = parseCsv(csv)
  } catch (e: any) {
    return res.status(400).json({ message: `Could not parse CSV: ${e?.message}` })
  }
  if (rows.length === 0) {
    return res
      .status(400)
      .json({ message: "No data rows found (need a header row + at least one row)." })
  }

  try {
    const plans = await planImport(req.scope as any, rows)
    const summary = {
      total: plans.length,
      create: plans.filter((p) => p.action === "create").length,
      update: plans.filter((p) => p.action === "update").length,
      error: plans.filter((p) => p.action === "error").length,
    }
    return res.json({ headers: TEMPLATE_HEADERS, summary, plans })
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Preview failed" })
  }
}
