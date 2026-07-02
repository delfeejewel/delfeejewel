import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { FraudContext, getFraudConfig } from "./fraud"

/** A COD/manual provider carries no online payment commitment. */
function isCodProvider(providerId?: string | null): boolean {
  const id = (providerId || "").toLowerCase()
  return id.includes("cod") || id.includes("manual") || id.includes("system")
}

/**
 * Payment-session statuses that mean a payment attempt genuinely FAILED.
 * Per Medusa's PaymentSessionStatus enum: "error" (declined/processing error)
 * and "canceled" (abandoned/superseded). We deliberately exclude
 * "requires_more" — that's an in-progress action state (3DS/UPI) a legitimate
 * customer passes through, so counting it would false-positive on normal
 * card/UPI checkouts.
 */
const FAILED_SESSION_STATUSES = new Set(["error", "canceled"])

/**
 * Assemble the normalized FraudContext for an order from data we already
 * hold: the order itself, the buyer's order history, the cart's payment
 * sessions, and the shipping/billing addresses. All I/O lives here so the
 * scorer (lib/fraud.ts) stays pure.
 *
 * Returns null if the order can't be loaded (the subscriber then no-ops).
 */
export async function buildFraudContext(
  container: MedusaContainer,
  orderId: string
): Promise<FraudContext | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const config = getFraudConfig()

  const { data: [order] } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "customer_id",
      "email",
      "total",
      "created_at",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "shipping_address.city",
      "shipping_address.postal_code",
      "shipping_address.country_code",
      "billing_address.first_name",
      "billing_address.last_name",
      "billing_address.city",
      "billing_address.postal_code",
      "billing_address.country_code",
      "payment_collections.payments.provider_id",
      "payment_collections.payment_sessions.status",
      "payment_collections.payment_sessions.provider_id",
      // COD upfront token is stamped on the cart at verify time.
      "cart.metadata",
    ],
    filters: { id: orderId },
  })

  if (!order) return null

  const o = order as any
  const total = Number(o.total) || 0
  const isGuest = !o.customer_id

  // --- COD detection + upfront token paid -------------------------------
  const collections: any[] = o.payment_collections || []
  const providerIds: string[] = collections.flatMap((pc) => [
    ...((pc.payments || []).map((p: any) => p.provider_id)),
    ...((pc.payment_sessions || []).map((s: any) => s.provider_id)),
  ])
  const isCod = providerIds.some((pid) => isCodProvider(pid))
  const cartMeta = (o.cart?.metadata as any) || {}
  const codUpfrontPaid = Number(cartMeta.cod_upfront_amount) || 0

  // --- Repeated failed payment attempts (R4) ----------------------------
  const failedPaymentSessions = collections
    .flatMap((pc) => pc.payment_sessions || [])
    .filter((s: any) => FAILED_SESSION_STATUSES.has(s?.status)).length

  // --- Buyer order history (R1) + velocity (R3) -------------------------
  // Match by customer_id when logged in, else by email (guest). Count
  // non-canceled orders, excluding this one.
  const orFilters: any[] = []
  if (o.customer_id) orFilters.push({ customer_id: o.customer_id })
  if (o.email) orFilters.push({ email: o.email })

  let priorOrderCount = 0
  let recentOrderCount = 1 // this order counts toward velocity
  if (orFilters.length) {
    const { data: history } = await query.graph({
      entity: "order",
      fields: ["id", "created_at", "canceled_at"],
      filters: orFilters.length > 1 ? ({ $or: orFilters } as any) : orFilters[0],
    })

    const windowMs = config.velocityWindowHrs * 60 * 60 * 1000
    const thisCreated = o.created_at ? new Date(o.created_at).getTime() : null

    for (const h of (history as any[]) || []) {
      if (h.id === o.id) continue
      if (h.canceled_at) continue
      priorOrderCount += 1
      if (thisCreated && h.created_at) {
        const dt = thisCreated - new Date(h.created_at).getTime()
        if (dt >= 0 && dt <= windowMs) recentOrderCount += 1
      }
    }
  }

  return {
    total,
    priorOrderCount,
    isGuest,
    isCod,
    codUpfrontPaid,
    recentOrderCount,
    failedPaymentSessions,
    shipping: o.shipping_address || undefined,
    billing: o.billing_address || undefined,
  }
}
