import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * POST /admin/flagged-carts/:id/dismiss
 * Clears the review flag — use after the payment has been handled manually
 * (e.g. refunded in the Razorpay dashboard). Keeps an audit trail in metadata.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.params.id
  const { note } = (req.body || {}) as { note?: string }
  const cartModule: any = req.scope.resolve(Modules.CART)

  const cart = await cartModule.retrieveCart(cartId).catch(() => null)
  if (!cart) return res.status(404).json({ message: "Cart not found" })

  const m = (cart.metadata as any) || {}
  await cartModule.updateCarts(cartId, {
    metadata: {
      ...m,
      reconcile_status: "dismissed",
      reconcile_dismissed_at: new Date().toISOString(),
      reconcile_dismiss_note: note || null,
    },
  })

  return res.json({ dismissed: true })
}
