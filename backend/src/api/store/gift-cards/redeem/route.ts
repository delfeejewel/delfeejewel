import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

import { GIFT_CARD_MODULE } from "../../../../modules/gift_card"

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

  // 4. Compute apply amount = min(balance, cart.total)
  const cartTotal = Number(cart.total) || 0
  const balance = Number(gc.balance) || 0
  const applied = Math.min(balance, cartTotal)
  if (applied <= 0) {
    return ERR(res, 400, "Cart total is already covered.")
  }

  // 5. Add credit line to cart + decrement balance on the gift card
  await cartModule.createCreditLines([
    {
      cart_id,
      amount: applied,
      reference: "gift_card",
      reference_id: gc.id,
      metadata: { gift_card_code: gc.code },
    },
  ])

  const newBalance = balance - applied
  await giftCardModule.updateGiftCards([
    {
      id: gc.id,
      balance: newBalance,
      status: newBalance <= 0 ? "redeemed" : "active",
    },
  ])

  return res.json({
    code: gc.code,
    applied,
    balance_remaining: newBalance,
  })
}

/**
 * DELETE /store/gift-cards/redeem
 * Remove an applied gift card from the cart and restore its balance.
 *
 * Body: { cart_id: string, code: string }
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

  const restored = creditLines.reduce(
    (sum: number, cl: any) => sum + Number(cl.amount || 0),
    0
  )

  await cartModule.deleteCreditLines(creditLines.map((cl: any) => cl.id))
  await giftCardModule.updateGiftCards([
    {
      id: gc.id,
      balance: Number(gc.balance || 0) + restored,
      status: "active",
    },
  ])

  return res.json({
    code: gc.code,
    restored,
    balance: Number(gc.balance || 0) + restored,
  })
}
