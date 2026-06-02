import { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { refundPaymentsWorkflow } from "@medusajs/medusa/core-flows"

import { convertToLocale } from "../utils/money"

/** Detect "online / refundable" payment providers vs COD / manual. */
function isOnlineProvider(providerId?: string | null): boolean {
  const id = (providerId || "").toLowerCase()
  if (!id) return false
  if (id.includes("cod") || id.includes("manual") || id.includes("system"))
    return false
  return (
    id.includes("razor") ||
    id.includes("stripe") ||
    id.includes("paypal") ||
    id.startsWith("pp_")
  )
}

export type RtoResult = {
  success: boolean
  alreadyProcessed?: boolean
  restocked: boolean
  refunded: boolean
  refundAmount: number
  refundError?: string | null
}

/**
 * RTO refund + restock pipeline. Idempotent (bails if rto_processed_at set).
 *
 * Steps: restock items → refund prepaid payments → mark order metadata →
 * email customer → email admin.
 *
 * Called from the Shiprocket webhook on "RTO Delivered" and from the manual
 * admin endpoint /admin/orders/:id/process-rto.
 */
export async function processRtoRefund(
  orderId: string,
  container: MedusaContainer
): Promise<RtoResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderModule: any = container.resolve(Modules.ORDER)
  const inventoryModule: any = container.resolve(Modules.INVENTORY)
  const stockLocationModule: any = container.resolve(Modules.STOCK_LOCATION)
  const emailService: any = container.resolve("email_notification")

  // 1. Fetch the order with everything we need
  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: [
      "id",
      "display_id",
      "email",
      "currency_code",
      "total",
      "metadata",
      "items.id",
      "items.title",
      "items.quantity",
      "items.variant_id",
      "items.variant.id",
      "items.variant.inventory_items.id",
      "items.variant.inventory_items.inventory.id",
      "payment_collections.payments.id",
      "payment_collections.payments.amount",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.provider_id",
      "shipping_address.first_name",
    ],
  })

  const order = (orders as any[])?.[0]
  if (!order) {
    logger.warn(`RTO: no order with id ${orderId}`)
    return { success: false, restocked: false, refunded: false, refundAmount: 0 }
  }

  // 2. Idempotency
  const meta = (order.metadata || {}) as any
  if (meta.rto_processed_at) {
    logger.info(`RTO: order #${order.display_id} already processed — skipping`)
    return {
      success: true,
      alreadyProcessed: true,
      restocked: !!meta.rto_restocked,
      refunded: !!meta.rto_refund_amount,
      refundAmount: Number(meta.rto_refund_amount || 0),
    }
  }

  // 3. Restock — adjust inventory at the (first) stock location
  let restocked = false
  try {
    const locations = await stockLocationModule.listStockLocations(
      {},
      { take: 1 }
    )
    const location = locations?.[0]
    if (!location) {
      logger.warn(`RTO: no stock location — skipping restock`)
    } else {
      const adjustments: any[] = []
      for (const item of (order.items as any[]) || []) {
        const invItems =
          item?.variant?.inventory_items ||
          (item?.variant as any)?.inventory_items_link ||
          []
        const qty = Number(item.quantity || 0)
        if (!qty) continue
        for (const ii of invItems) {
          // The link can shape it as { id, inventory: { id } } depending on graph form
          const inventoryItemId = ii?.inventory?.id || ii?.id
          if (!inventoryItemId) continue
          adjustments.push({
            inventoryItemId,
            locationId: location.id,
            adjustment: qty,
          })
        }
      }
      if (adjustments.length) {
        await inventoryModule.adjustInventory(adjustments)
        restocked = true
        logger.info(
          `RTO: restocked ${adjustments.length} inventory item(s) for order #${order.display_id}`
        )
      } else {
        logger.warn(
          `RTO: order #${order.display_id} had no resolvable inventory items to restock`
        )
      }
    }
  } catch (e: any) {
    logger.error(`RTO restock failed for order #${order.display_id}: ${e.message}`)
  }

  // 4. Refund — only if there's a captured online payment
  const allPayments: any[] = ((order.payment_collections as any[]) || [])
    .flatMap((pc) => pc?.payments || [])
    .filter(Boolean)
  const refundable = allPayments.filter(
    (p) => p?.captured_at && isOnlineProvider(p?.provider_id)
  )
  const isPrepaid = refundable.length > 0

  let refundAmount = 0
  let refundError: string | null = null

  if (isPrepaid) {
    try {
      for (const p of refundable) {
        await refundPaymentsWorkflow(container).run({
          input: {
            payment_id: p.id,
            amount: Number(p.amount || 0),
          } as any,
        })
      }
      refundAmount = refundable.reduce(
        (s, p) => s + Number(p.amount || 0),
        0
      )
      logger.info(
        `RTO: refunded ${refundAmount} ${order.currency_code} for order #${order.display_id}`
      )
    } catch (e: any) {
      refundError = e?.message || "Unknown refund error"
      logger.error(`RTO refund failed for order #${order.display_id}: ${refundError}`)
    }
  } else {
    logger.info(
      `RTO: order #${order.display_id} has no online captured payment — no refund needed (COD / manual).`
    )
  }

  // 5. Mark the order
  const nowIso = new Date().toISOString()
  await orderModule.updateOrders([
    {
      id: order.id,
      metadata: {
        ...meta,
        rto_processed_at: nowIso,
        rto_restocked: restocked,
        rto_refund_amount: refundAmount,
        rto_refund_currency: order.currency_code,
        rto_refund_error: refundError,
      },
    },
  ])

  // 6. Email the customer
  if (order.email) {
    await emailService.sendRtoRefundEmail({
      customer_email: order.email,
      customer_name:
        (order.shipping_address as any)?.first_name || "Customer",
      order_number: order.display_id,
      refund_amount: isPrepaid
        ? convertToLocale(refundAmount, order.currency_code)
        : null,
      is_prepaid: isPrepaid,
      brand_name: process.env.BRAND_NAME || "Delfee",
    })
  }

  // 7. Email the admin (warehouse)
  const adminEmail =
    process.env.RTO_ADMIN_EMAIL ||
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    process.env.SMTP_FROM ||
    null
  if (adminEmail) {
    await emailService.sendRtoAdminEmail({
      to: adminEmail,
      order_number: order.display_id,
      refund_amount: isPrepaid
        ? convertToLocale(refundAmount, order.currency_code)
        : null,
      refunded: isPrepaid && !refundError,
      restocked,
      items: ((order.items as any[]) || []).map((it) => ({
        title: it.title,
        quantity: Number(it.quantity || 0),
      })),
      brand_name: process.env.BRAND_NAME || "Delfee",
    })
  }

  return {
    success: true,
    restocked,
    refunded: isPrepaid && !refundError,
    refundAmount,
    refundError,
  }
}
