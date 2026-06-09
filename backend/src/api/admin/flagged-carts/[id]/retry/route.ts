import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { reconcilePaidCart } from "../../../../../lib/reconcile-paid-cart"

/**
 * POST /admin/flagged-carts/:id/retry
 * Re-attempts to complete a flagged (paid-but-no-order) cart into an order.
 * Succeeds → the cart completes and drops off the review list. Fails → it stays
 * flagged with the latest reason.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.params.id
  const cartModule: any = req.scope.resolve(Modules.CART)

  const cart = await cartModule.retrieveCart(cartId).catch(() => null)
  if (!cart) return res.status(404).json({ message: "Cart not found" })

  const m = (cart.metadata as any) || {}
  const result = await reconcilePaidCart(req.scope, cartId, {
    razorpay_payment_id: m.reconcile_payment_id || m.cod_upfront_payment_id,
    amount: Number(m.reconcile_amount ?? m.cod_upfront_amount ?? 0),
    is_cod_token: !!(m.reconcile_is_cod_token ?? m.cod_upfront_payment_id),
  })

  return res.json(result)
}
