import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"

type Scope = { resolve: (k: any) => any }

type PaidInfo = {
  razorpay_payment_id?: string
  razorpay_order_id?: string
  amount?: number // major units (₹)
  is_cod_token?: boolean
}

type ReconcileResult = {
  status: "already_order" | "completed" | "needs_review" | "no_cart"
  order_id?: string
}

/**
 * Map a captured Razorpay payment to its Medusa cart.
 *  - COD token orders carry `notes.cart_id` directly.
 *  - Online payments carry `notes.session_id`; resolve cart via the
 *    payment-session → payment-collection → cart link.
 */
export async function resolveCartId(
  scope: Scope,
  notes: Record<string, any>
): Promise<string | null> {
  if (notes?.cart_id) return notes.cart_id
  const sessionId = notes?.session_id
  if (!sessionId) return null

  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  try {
    const { data: sessions } = await query.graph({
      entity: "payment_session",
      fields: ["id", "payment_collection_id"],
      filters: { id: sessionId },
    })
    const pcId = (sessions as any[])?.[0]?.payment_collection_id
    if (!pcId) return null

    const { data: cols } = await query.graph({
      entity: "payment_collection",
      fields: ["id", "cart.id"],
      filters: { id: pcId },
    })
    return (cols as any[])?.[0]?.cart?.id ?? null
  } catch {
    return null
  }
}

/**
 * Reconcile a Razorpay-captured payment whose order may never have been created
 * (browser died / placeOrder never ran). Idempotent:
 *  - cart already completed → no-op (the order already exists)
 *  - else → (for COD) record the token, then complete the cart into an order
 *  - if completion fails → flag the cart `needs_review` for an admin
 */
export async function reconcilePaidCart(
  scope: Scope,
  cartId: string,
  info: PaidInfo
): Promise<ReconcileResult> {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const cartModule: any = scope.resolve(Modules.CART)

  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["id", "completed_at", "metadata", "email"],
    filters: { id: cartId },
  })
  const cart = (carts as any[])?.[0]
  if (!cart) return { status: "no_cart" }

  // Normal happy path: the storefront already completed the cart before the
  // webhook arrived → an order exists, nothing to reconcile.
  if (cart.completed_at) return { status: "already_order" }

  const meta = (cart.metadata as any) || {}

  // For a COD token, record the payment on the cart so the order.placed
  // subscriber bridges it onto the order when we complete below.
  if (
    info.is_cod_token &&
    info.razorpay_payment_id &&
    !meta.cod_upfront_payment_id
  ) {
    try {
      await cartModule.updateCarts(cartId, {
        metadata: {
          ...meta,
          cod_upfront_amount:
            info.amount ?? Number(meta.cod_pending_amount) ?? 0,
          cod_upfront_payment_id: info.razorpay_payment_id,
          cod_upfront_paid_at: new Date().toISOString(),
        },
      })
    } catch (e: any) {
      logger.warn(
        `reconcile: could not stamp COD token on cart ${cartId}: ${e?.message}`
      )
    }
  }

  // Turn the paid cart into an order.
  try {
    const { result } = await completeCartWorkflow(scope as any).run({
      input: { id: cartId },
    })
    const orderId = (result as any)?.id
    logger.info(`reconcile: completed cart ${cartId} -> order ${orderId}`)
    return { status: "completed", order_id: orderId }
  } catch (e: any) {
    const msg = e?.message || "complete failed"
    // Lost a race with the storefront completing it → that's fine.
    if (/already|completed/i.test(msg)) {
      return { status: "already_order" }
    }
    // Genuinely couldn't complete (e.g. item out of stock) → flag for admin.
    logger.error(`reconcile: cart ${cartId} paid but could not complete: ${msg}`)
    try {
      const fresh = (await cartModule.retrieveCart(cartId))?.metadata || {}
      await cartModule.updateCarts(cartId, {
        metadata: {
          ...fresh,
          reconcile_status: "needs_review",
          reconcile_reason: msg,
          reconcile_payment_id: info.razorpay_payment_id,
          reconcile_amount: info.amount ?? null,
          reconcile_is_cod_token: !!info.is_cod_token,
          reconcile_flagged_at: new Date().toISOString(),
        },
      })
    } catch {
      // best-effort flag
    }
    return { status: "needs_review" }
  }
}
