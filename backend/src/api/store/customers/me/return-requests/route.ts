import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { RETURN_REQUEST_MODULE } from "../../../../../modules/return_request"

const RETURN_WINDOW_DAYS =
  Number(process.env.RETURN_WINDOW_DAYS) > 0
    ? Number(process.env.RETURN_WINDOW_DAYS)
    : 15

const VALID_REASONS = [
  "wrong_size",
  "different_from_description",
  "damaged",
  "quality",
  "changed_mind",
  "other",
] as const

const OPEN_STATUSES = ["pending", "approved", "received"] as const

const ERR = (res: MedusaResponse, status: number, message: string) =>
  res.status(status).json({ message })

/**
 * GET /store/customers/me/return-requests
 * List the signed-in customer's return requests (newest first).
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) return ERR(res, 401, "Authentication required")

  const returnModule: any = req.scope.resolve(RETURN_REQUEST_MODULE)
  const requests = await returnModule.listReturnRequests({
    customer_id: customerId,
  })
  // Newest first
  requests.sort(
    (a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  return res.json({ return_requests: requests })
}

/**
 * POST /store/customers/me/return-requests
 * Submit a new return request for a delivered order.
 *
 * Body: {
 *   order_id: string,
 *   reason: one of VALID_REASONS,
 *   message?: string,
 *   items: [{ line_item_id, quantity, reason? }]
 * }
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) return ERR(res, 401, "Authentication required")

  const { order_id, reason, message, items, type } = (req.body || {}) as {
    order_id?: string
    reason?: string
    message?: string
    type?: "refund" | "exchange"
    items?: Array<{
      line_item_id: string
      quantity: number
      reason?: string
      exchange_variant_id?: string
    }>
  }

  if (!order_id) return ERR(res, 400, "order_id is required")
  if (!reason || !VALID_REASONS.includes(reason as any)) {
    return ERR(
      res,
      400,
      `reason must be one of: ${VALID_REASONS.join(", ")}`
    )
  }
  if (!Array.isArray(items) || items.length === 0) {
    return ERR(res, 400, "Select at least one item to return.")
  }

  const requestType: "refund" | "exchange" =
    type === "exchange" ? "exchange" : "refund"

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const returnModule: any = req.scope.resolve(RETURN_REQUEST_MODULE)
  const emailService: any = req.scope.resolve("email_notification")

  // Fetch the order with items
  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: order_id },
    fields: [
      "id",
      "display_id",
      "email",
      "customer_id",
      "currency_code",
      "metadata",
      "items.id",
      "items.title",
      "items.thumbnail",
      "items.quantity",
      "items.unit_price",
      "items.variant_id",
      "items.product_id",
      "items.variant_title",
      "items.product_title",
    ],
  })
  const order = (orders as any[])?.[0]
  if (!order) return ERR(res, 404, "Order not found.")

  // Ownership
  if (order.customer_id !== customerId) {
    return ERR(res, 404, "Order not found.")
  }

  // Delivered + within window
  const meta = (order.metadata || {}) as any
  const deliveredAt = meta.delivered_at
  if (!deliveredAt) {
    return ERR(
      res,
      400,
      "This order isn't delivered yet — returns can only be requested after delivery."
    )
  }
  const ageMs = Date.now() - new Date(deliveredAt).getTime()
  const windowMs = RETURN_WINDOW_DAYS * 86400_000
  if (ageMs > windowMs) {
    return ERR(
      res,
      400,
      `Returns are accepted within ${RETURN_WINDOW_DAYS} days of delivery. This order is past that window.`
    )
  }

  // No open existing return for this order
  const existing = await returnModule.listReturnRequests({
    order_id,
    customer_id: customerId,
  })
  const openOne = (existing || []).find((r: any) =>
    OPEN_STATUSES.includes(r.status)
  )
  if (openOne) {
    return ERR(
      res,
      409,
      "You already have an active return request for this order."
    )
  }

  // Validate requested items are part of the order + quantities
  const orderItemsById = new Map(
    ((order.items as any[]) || []).map((it) => [it.id, it])
  )

  // For exchanges, every selected line needs a target variant; we resolve them in a single query.
  const isExchange = requestType === "exchange"
  const exchangeVariantIds = isExchange
    ? Array.from(
        new Set(
          (items || [])
            .map((s) => s.exchange_variant_id)
            .filter((v): v is string => typeof v === "string" && v.length > 0)
        )
      )
    : []

  if (isExchange) {
    const missing = (items || []).filter((s) => !s.exchange_variant_id)
    if (missing.length) {
      return ERR(
        res,
        400,
        "Exchange requires an exchange_variant_id for every item."
      )
    }
  }

  const variantById = new Map<string, any>()
  if (exchangeVariantIds.length) {
    const { data: vs } = await query.graph({
      entity: "variant",
      filters: { id: exchangeVariantIds } as any,
      fields: [
        "id",
        "product_id",
        "title",
        "price_set.prices.amount",
        "price_set.prices.currency_code",
        "price_set.prices.min_quantity",
      ],
    })
    for (const v of (vs as any[]) || []) variantById.set(v.id, v)
  }

  const priceForCurrency = (variant: any, currency: string): number | null => {
    const prices = variant?.price_set?.prices || []
    const match = prices.find(
      (p: any) =>
        String(p.currency_code).toLowerCase() === currency.toLowerCase() &&
        (p.min_quantity == null || Number(p.min_quantity) <= 1)
    )
    return match ? Number(match.amount) : null
  }

  const itemRows: any[] = []
  let total = 0
  for (const sel of items) {
    const oi = orderItemsById.get(sel.line_item_id)
    if (!oi) {
      return ERR(res, 400, `Item ${sel.line_item_id} isn't in this order.`)
    }
    const qty = Number(sel.quantity || 0)
    if (qty < 1 || qty > Number(oi.quantity)) {
      return ERR(
        res,
        400,
        `Quantity for "${oi.title}" must be between 1 and ${oi.quantity}.`
      )
    }
    const unit = Number(oi.unit_price || 0)
    total += unit * qty

    let exchangeVariantId: string | null = null
    if (isExchange) {
      const targetId = sel.exchange_variant_id!
      const variant = variantById.get(targetId)
      if (!variant) {
        return ERR(
          res,
          400,
          `Exchange variant ${targetId} was not found.`
        )
      }
      if (variant.product_id !== oi.product_id) {
        return ERR(
          res,
          400,
          `Exchange variant for "${oi.title}" must belong to the same product.`
        )
      }
      if (targetId === oi.variant_id) {
        return ERR(
          res,
          400,
          `Pick a different variant of "${oi.title}" to exchange for.`
        )
      }
      const targetPrice = priceForCurrency(variant, order.currency_code)
      if (targetPrice == null || targetPrice !== unit) {
        return ERR(
          res,
          400,
          `Exchange variant for "${oi.title}" must match the original price.`
        )
      }
      exchangeVariantId = targetId
    }

    itemRows.push({
      line_item_id: oi.id,
      variant_id: oi.variant_id,
      product_id: oi.product_id,
      title: oi.title,
      thumbnail: oi.thumbnail,
      quantity: qty,
      unit_price: unit,
      reason: sel.reason || null,
      exchange_variant_id: exchangeVariantId,
    })
  }

  // Create
  const created = await returnModule.createReturnRequests({
    order_id,
    customer_id: customerId,
    type: requestType,
    status: "pending",
    reason,
    message: message?.trim() || null,
    refund_amount: isExchange ? null : total,
    currency_code: order.currency_code,
    items: itemRows,
  })
  const rr = Array.isArray(created) ? created[0] : created

  // Emails — fire and forget, don't fail the request
  if (isExchange) {
    const exchangeItems = itemRows.map((it) => {
      const oi = orderItemsById.get(it.line_item_id)
      const target = variantById.get(it.exchange_variant_id || "")
      return {
        title: oi?.product_title || it.title,
        from_variant: oi?.variant_title || "current",
        to_variant: target?.title || "new variant",
        quantity: it.quantity,
      }
    })
    Promise.resolve()
      .then(() =>
        emailService.sendExchangeSubmittedEmail({
          customer_email: order.email,
          customer_name: "Customer",
          order_number: order.display_id,
          request_id: rr.id,
          items: exchangeItems,
          brand_name: process.env.BRAND_NAME || "Delfee",
        })
      )
      .catch(() => {})
  } else {
    Promise.resolve()
      .then(() =>
        emailService.sendReturnSubmittedEmail({
          customer_email: order.email,
          customer_name: "Customer",
          order_number: order.display_id,
          request_id: rr.id,
          brand_name: process.env.BRAND_NAME || "Delfee",
        })
      )
      .catch(() => {})
  }

  const adminEmail =
    process.env.RTO_ADMIN_EMAIL ||
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    process.env.SMTP_FROM
  if (adminEmail) {
    Promise.resolve()
      .then(() =>
        emailService.sendReturnAdminAlertEmail({
          to: adminEmail,
          customer_email: order.email,
          order_number: order.display_id,
          request_id: rr.id,
          reason: `${isExchange ? "[EXCHANGE] " : ""}${reason}`,
          items: itemRows.map((it) => ({
            title: it.title,
            quantity: it.quantity,
          })),
          brand_name: process.env.BRAND_NAME || "Delfee",
        })
      )
      .catch(() => {})
  }

  return res.status(201).json({ return_request: rr })
}
