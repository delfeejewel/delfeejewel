import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getFeatureFlags } from "../../../lib/feature-flags"

/**
 * GET /store/feature-flags
 * Public (publishable-key) read of the storefront feature toggles, so the
 * storefront can hide disabled features (e.g. returns) server-side.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const flags = await getFeatureFlags(req.scope)
  return res.json({ flags })
}
