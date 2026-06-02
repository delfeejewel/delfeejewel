import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { GIFT_CARD_MODULE } from "../../../../modules/gift_card"

/**
 * GET /store/gift-cards/:code
 * Public balance check. Returns the gift card's current balance, currency,
 * status and expiry — useful for the storefront to validate before redeem.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const code = String(req.params.code || "")
    .toUpperCase()
    .trim()

  if (!code) {
    return res.status(400).json({ message: "Code is required." })
  }

  const giftCardModule: any = req.scope.resolve(GIFT_CARD_MODULE)
  const [gc] = await giftCardModule.listGiftCards({ code }, { take: 1 })

  if (!gc) {
    return res.status(404).json({ message: "Gift card not found." })
  }

  return res.json({
    code: gc.code,
    balance: gc.balance,
    value: gc.value,
    currency_code: gc.currency_code,
    status: gc.status,
    expires_at: gc.expires_at,
  })
}
