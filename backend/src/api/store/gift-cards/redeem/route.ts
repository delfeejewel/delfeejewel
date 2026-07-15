import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

import { GIFT_CARD_MODULE } from "../../../../modules/gift_card"
import { pendingHolds } from "../../../../modules/gift_card/lib/holds"

const ERR = (res: MedusaResponse, status: number, message: string) =>
  res.status(status).json({ message })

function isExpired(expires_at: string | Date | null | undefined): boolean {
  if (!expires_at) return false
  return new Date(expires_at).getTime() < Date.now()
}

/**
 * POST /store/gift-cards/redeem
 * Apply a gift card code to a cart.
 *
 * Body: { cart_id: string, code: string }
 * Response: { applied: number, balance_remaining: number, code: string }
 *
 * NOTE: applying does NOT decrement the gift card balance. It only records a
 * cart credit line (a hold). The balance is decremented once, at order
 * placement, by the gift-card-redeemed subscriber. This prevents balance from
 * being stranded on abandoned carts and prevents the same card being spent on
 * two carts.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { cart_id, code } = (req.body || {}) as {
    cart_id?: string
    code?: string
  }
  if (!cart_id || !code) {
    return ERR(res, 400, "cart_id and code are required")
  }

  const giftCardModule: any = req.scope.resolve(GIFT_CARD_MODULE)
  const cartModule: any = req.scope.resolve(Modules.CART)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // 1. Lookup gift card
  const [gc] = await giftCardModule.listGiftCards(
    { code: code.toUpperCase().trim() },
    { take: 1 }
  )
  if (!gc) return ERR(res, 404, "Invalid gift card code.")
  if (gc.status !== "active") {
    return ERR(res, 400, "This gift card is no longer active.")
  }
  if (gc.balance <= 0) {
    return ERR(res, 400, "This gift card has no balance remaining.")
  }
  if (isExpired(gc.expires_at)) {
    await giftCardModule.updateGiftCards([{ id: gc.id, status: "expired" }])
    return ERR(res, 400, "This gift card has expired.")
  }

  // 2. Make sure the cart exists + the currency matches
  const { data: carts } = await query.graph({
    entity: "cart",
    filters: { id: cart_id },
    fields: ["id", "currency_code", "total", "credit_lines.*"],
  })
  const cart = carts?.[0] as any
  if (!cart) return ERR(res, 404, "Cart not found.")
  if (cart.currency_code !== gc.currency_code) {
    return ERR(
      res,
      400,
      `This gift card is in ${gc.currency_code.toUpperCase()} and your cart is in ${cart.currency_code.toUpperCase()}.`
    )
  }

  // 3. Prevent re-applying the same card to this cart
  const already = (cart.credit_lines || []).some(
    (cl: any) => cl?.reference === "gift_card" && cl?.reference_id === gc.id
  )
  if (already) {
    return ERR(res, 409, "This gift card is already applied to your cart.")
  }

  // 4. Available = balance minus what this card already holds on other carts.
  const balance = Number(gc.balance) || 0
  const holds = await pendingHolds(req.scope, gc.id, cart_id)
  const available = balance - holds
  if (available <= 0) {
    return ERR(
      res,
      409,
      "This gift card's balance is already committed to another cart."
    )
  }

  // 5. Apply amount = min(available balance, cart total).
  const cartTotal = Number(cart.total) || 0
  const applied = Math.min(available, cartTotal)
  if (applied <= 0) {
    return ERR(res, 400, "Cart total is already covered.")
  }

  // 6. Record the hold as a cart credit line. Balance is untouched here.
  const created = await cartModule.createCreditLines([
    {
      cart_id,
      amount: applied,
      reference: "gift_card",
      reference_id: gc.id,
      metadata: { gift_card_code: gc.code, consumed: false },
    },
  ])
  const createdLine = Array.isArray(created) ? created[0] : created

  // 7. Close the redeem race (TOCTOU): two carts redeeming the same card
  // concurrently both pass the check at step 4 and both write a hold. Re-read
  // ALL live holds now and give precedence to the earliest-created line — ours
  // only keeps the room left after every hold created before it. This is
  // deterministic (created_at, then id) so exactly one winner emerges without a
  // DB lock; over-committed later holds are clamped or rolled back.
  try {
    const allLines = await cartModule.listCreditLines({
      reference: "gift_card",
      reference_id: gc.id,
    })
    const liveCartIds = [
      ...new Set(
        (allLines || [])
          .filter((cl: any) => cl?.metadata?.consumed !== true)
          .map((cl: any) => cl.cart_id)
      ),
    ]
    const { data: liveCarts } = await query.graph({
      entity: "cart",
      filters: { id: liveCartIds } as any,
      fields: ["id", "completed_at"],
    })
    const completedCarts = new Set(
      (liveCarts || []).filter((c: any) => c.completed_at).map((c: any) => c.id)
    )
    const ordered = (allLines || [])
      .filter(
        (cl: any) =>
          cl?.metadata?.consumed !== true && !completedCarts.has(cl.cart_id)
      )
      .sort((a: any, b: any) => {
        const ta = new Date(a.created_at).getTime()
        const tb = new Date(b.created_at).getTime()
        if (ta !== tb) return ta - tb
        return String(a.id) < String(b.id) ? -1 : 1
      })

    let sumBefore = 0
    for (const cl of ordered) {
      if (cl.id === createdLine.id) break
      sumBefore += Number(cl.amount || 0)
    }
    const room = Math.max(0, balance - sumBefore)
    const finalAmount = Math.min(applied, room)

    if (finalAmount <= 0) {
      await cartModule.deleteCreditLines([createdLine.id])
      return ERR(
        res,
        409,
        "This gift card's balance was just committed to another cart."
      )
    }
    if (finalAmount !== applied) {
      await cartModule.updateCreditLines([
        { id: createdLine.id, amount: finalAmount },
      ])
    }

    return res.json({
      code: gc.code,
      applied: finalAmount,
      balance_remaining: balance - sumBefore - finalAmount,
    })
  } catch {
    // If the re-check itself fails, fall back to the originally applied amount
    // (the reconcile-before-complete middleware clamps again as a backstop).
    return res.json({
      code: gc.code,
      applied,
      balance_remaining: available - applied,
    })
  }
}

/**
 * DELETE /store/gift-cards/redeem
 * Remove an applied gift card from the cart.
 *
 * Body: { cart_id: string, code: string }
 *
 * Only the cart credit line (hold) is removed. The balance was never
 * decremented at apply time, so there is nothing to restore.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { cart_id, code } = (req.body || {}) as {
    cart_id?: string
    code?: string
  }
  if (!cart_id || !code) {
    return ERR(res, 400, "cart_id and code are required")
  }

  const giftCardModule: any = req.scope.resolve(GIFT_CARD_MODULE)
  const cartModule: any = req.scope.resolve(Modules.CART)

  const [gc] = await giftCardModule.listGiftCards(
    { code: code.toUpperCase().trim() },
    { take: 1 }
  )
  if (!gc) return ERR(res, 404, "Gift card not found.")

  const creditLines = await cartModule.listCreditLines({
    cart_id,
    reference: "gift_card",
    reference_id: gc.id,
  })
  if (!creditLines?.length) {
    return ERR(res, 404, "This gift card is not applied to your cart.")
  }

  // Don't allow removing a hold that has already been reconciled (order placed).
  const consumed = creditLines.filter((cl: any) => cl?.metadata?.consumed === true)
  if (consumed.length) {
    return ERR(res, 409, "This gift card has already been redeemed on an order.")
  }

  await cartModule.deleteCreditLines(creditLines.map((cl: any) => cl.id))

  return res.json({ code: gc.code, removed: true })
}
