import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { GIFT_CARD_MODULE } from "../../../modules/gift_card"
import { defaultExpiry, generateGiftCardCode } from "../../../modules/gift_card/lib/code"
import { convertToLocale } from "../../../utils/money"
import { actorHasPermission } from "../../../lib/rbac"

const ERR = (res: MedusaResponse, status: number, message: string) =>
  res.status(status).json({ message })

/**
 * GET /admin/gift-cards
 * List gift cards with optional filters.
 *
 * Query: q (matches code / recipient_email), status, offset, limit
 * Response: { gift_cards, count, offset, limit }
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const giftCardModule: any = req.scope.resolve(GIFT_CARD_MODULE)

  const q = (req.query.q as string)?.trim()
  const status = req.query.status as string | undefined
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0

  const filters: Record<string, any> = {}
  if (status && status !== "all") filters.status = status
  if (q) {
    const term = q.toUpperCase()
    filters.$or = [
      { code: { $ilike: `%${term}%` } },
      { recipient_email: { $ilike: `%${q.toLowerCase()}%` } },
    ]
  }

  const [gift_cards, count] = await giftCardModule.listAndCountGiftCards(
    filters,
    { take: limit, skip: offset, order: { created_at: "DESC" } }
  )

  return res.json({ gift_cards, count, offset, limit })
}

/**
 * POST /admin/gift-cards
 * Manually issue a gift card (e.g. customer-service goodwill credit).
 *
 * Body: { value, currency_code?, recipient_email, recipient_name?,
 *         message?, expires_at?, send_email? }
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  // Fail-closed handler guard — the RBAC middleware fails open on this prefix.
  if (!(await actorHasPermission(req, "giftcards.write"))) {
    return res.status(403).json({ message: "Access denied. Gift card permission required." })
  }

  const body = (req.body || {}) as {
    value?: number
    currency_code?: string
    recipient_email?: string
    recipient_name?: string
    message?: string
    expires_at?: string | null
    send_email?: boolean
  }

  const value = Number(body.value)
  if (!value || value <= 0) {
    return ERR(res, 400, "A positive value is required.")
  }
  if (!body.recipient_email?.trim()) {
    return ERR(res, 400, "recipient_email is required.")
  }

  const currency_code = (body.currency_code || "inr").toLowerCase()
  const expiresAt = body.expires_at ? new Date(body.expires_at) : defaultExpiry()

  const giftCardModule: any = req.scope.resolve(GIFT_CARD_MODULE)
  const emailService: any = req.scope.resolve("email_notification")

  const code = generateGiftCardCode()
  const created = await giftCardModule.createGiftCards({
    code,
    value,
    balance: value,
    currency_code,
    status: "active",
    expires_at: expiresAt,
    purchaser_order_id: null,
    purchaser_customer_id: null,
    recipient_email: body.recipient_email.trim().toLowerCase(),
    recipient_name: body.recipient_name?.trim() || null,
    message: body.message?.trim() || null,
    metadata: { issued_by: "admin" },
  })

  const giftCard = Array.isArray(created) ? created[0] : created

  if (body.send_email) {
    try {
      await emailService.sendGiftCardEmail({
        recipient_email: giftCard.recipient_email,
        recipient_name: giftCard.recipient_name,
        purchaser_name: null,
        code: giftCard.code,
        value: convertToLocale(value, currency_code),
        expires_at: expiresAt.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        message: giftCard.message,
        brand_name: process.env.BRAND_NAME || "Delfee",
      })
    } catch (e: any) {
      // Card is already created — surface the email failure but don't 500.
      return res.json({ gift_card: giftCard, email_error: e?.message || "Email failed" })
    }
  }

  return res.status(201).json({ gift_card: giftCard })
}
