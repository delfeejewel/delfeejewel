import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getCodPolicy } from "../../../utils/cod"

/**
 * GET /store/cod-policy
 * Returns the COD upfront-token policy so the storefront can render the
 * checkout breakdown without hard-coding values.
 *
 *   percent     — % of total collected upfront when total ≥ threshold
 *   threshold   — at/above this total use percent; below it use flat_amount
 *   flat_amount — flat token collected when total < threshold
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  return res.json(getCodPolicy())
}
