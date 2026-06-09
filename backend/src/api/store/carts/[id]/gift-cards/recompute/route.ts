import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { reconcileGiftCardHolds } from "../../../../../../modules/gift_card/lib/holds"

/**
 * POST /store/carts/:id/gift-cards/recompute
 * Re-clamp gift-card holds on the cart to the current totals. Safe to call
 * after any cart change; cheap no-op when the cart has no gift cards.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.params.id
  if (!cartId) return res.status(400).json({ message: "cart id is required" })

  await reconcileGiftCardHolds(req.scope, cartId)
  return res.json({ ok: true })
}
