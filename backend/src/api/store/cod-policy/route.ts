import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * GET /store/cod-policy
 * Returns the COD upfront-token policy so the storefront can render the
 * checkout breakdown without hard-coding values.
 *
 *   percent   — % of cart total collected upfront via Razorpay
 *   min_order — only require upfront when cart total ≥ this
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const percent = Number(process.env.COD_UPFRONT_PERCENT) || 5
  const min_order = Number(process.env.COD_UPFRONT_MIN_ORDER) || 500
  return res.json({
    percent,
    min_order,
    currency: "inr",
  })
}
