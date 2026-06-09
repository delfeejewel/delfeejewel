import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { GIFT_CARD_MODULE } from "../../../../modules/gift_card"

const ERR = (res: MedusaResponse, status: number, message: string) =>
  res.status(status).json({ message })

/**
 * GET /admin/gift-cards/:id — single gift card detail.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const giftCardModule: any = req.scope.resolve(GIFT_CARD_MODULE)
  const [gc] = await giftCardModule.listGiftCards({ id: req.params.id }, { take: 1 })
  if (!gc) return ERR(res, 404, "Gift card not found.")
  return res.json({ gift_card: gc })
}

/**
 * POST /admin/gift-cards/:id — administrative actions on a card.
 *
 * Body: { action: "void" | "reactivate" | "set_balance", balance? }
 *  - void        → status = "void"
 *  - reactivate  → status = "active" (only if it still has balance)
 *  - set_balance → set balance to `balance` (>= 0); status follows the new balance
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const id = req.params.id
  const { action, balance } = (req.body || {}) as {
    action?: string
    balance?: number
  }

  const giftCardModule: any = req.scope.resolve(GIFT_CARD_MODULE)
  const [gc] = await giftCardModule.listGiftCards({ id }, { take: 1 })
  if (!gc) return ERR(res, 404, "Gift card not found.")

  let patch: Record<string, any> = { id }

  switch (action) {
    case "void":
      patch.status = "void"
      break

    case "reactivate":
      if (Number(gc.balance) <= 0) {
        return ERR(res, 400, "Cannot reactivate a card with no balance remaining.")
      }
      patch.status = "active"
      break

    case "set_balance": {
      const next = Number(balance)
      if (!Number.isFinite(next) || next < 0) {
        return ERR(res, 400, "balance must be a number >= 0.")
      }
      patch.balance = next
      // Keep status coherent with the new balance, unless the card was voided.
      if (gc.status !== "void") {
        patch.status = next <= 0 ? "redeemed" : "active"
      }
      break
    }

    default:
      return ERR(res, 400, 'action must be "void", "reactivate", or "set_balance".')
  }

  await giftCardModule.updateGiftCards([patch])
  const [updated] = await giftCardModule.listGiftCards({ id }, { take: 1 })
  return res.json({ gift_card: updated })
}
