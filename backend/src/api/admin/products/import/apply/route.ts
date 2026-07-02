import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import {
  parseCsv,
  planImport,
  applyImport,
} from "../../../../../lib/supplier-import"
import { actorHasPermission } from "../../../../../lib/rbac"

/**
 * POST /admin/products/import/apply  → commit the import.
 *
 * Takes the SAME csv text as the preview, re-plans it server-side, then writes.
 * We deliberately don't trust a client-supplied plan (avoids tampering / TOCTOU);
 * the cost is one extra read pass, which is cheap.
 *
 * RBAC: covered by `^/admin/products` → products.write (POST is a write).
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  // Handler-level RBAC (middleware fails open under /admin/products — see route.ts).
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
    return res.status(400).json({ message: "No data rows found." })
  }

  try {
    const plans = await planImport(req.scope as any, rows)
    const results = await applyImport(req.scope as any, plans)
    const summary = {
      total: results.length,
      created: results.filter((r) => r.ok && r.action === "create").length,
      updated: results.filter((r) => r.ok && r.action === "update").length,
      failed: results.filter((r) => !r.ok).length,
    }
    return res.json({ summary, results })
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Import failed" })
  }
}
