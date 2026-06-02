import { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { refundPaymentWorkflow } from "@medusajs/medusa/core-flows"

import { convertToLocale } from "../utils/money"
import { RETURN_REQUEST_MODULE } from "../modules/return_request"

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

export type ReturnResult = {
  success: boolean
  alreadyProcessed?: boolean
  restocked: boolean
  refunded: boolean
  refundAmount: number
  refundError?: string | null
}

/**
 * Partial-return processor — restocks only the items in the request and
 * refunds the request's calculated amount (not necessarily the full order).
 * Idempotent on the return_request's processed_at field.
 */
export async function processReturnRefund(
  returnRequestId: string,
  container: MedusaContainer
): Promise<ReturnResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const returnModule: any = container.resolve(RETURN_REQUEST_MODULE)
  const inventoryModule: any = container.resolve(Modules.INVENTORY)
  const stockLocationModule: any = container.resolve(Modules.STOCK_LOCATION)
  const emailService: any = container.resolve("email_notification")

  // 1. Fetch return + items
  const [rr] = await returnModule.listReturnRequests(
    { id: returnRequestId },
    { take: 1, relations: ["items"] as any }
  )
  if (!rr) {
    logger.warn(`Return: no request ${returnRequestId}`)
    return { success: false, restocked: false, refunded: false, refundAmount: 0 }
  }
  if (rr.processed_at) {
    logger.info(`Return ${rr.id} already processed — skipping`)
    return {
      success: true,
      alreadyProcessed: true,
      restocked: true,
      refunded: !!rr.refund_amount,
      refundAmount: Number(rr.refund_amount || 0),
    }
  }

  // Re-query items via query.graph (relations option above is unreliable)
  const { data: items } = await query.graph({
    entity: "return_request_item",
    filters: { return_request_id: returnRequestId } as any,
    fields: ["id", "line_item_id", "variant_id", "title", "quantity", "unit_price"],
  })
  const reqItems = (items as any[]) || []

  // 2. Restock — query each variant's inventory items, adjust at first location
  let restocked = false
  try {
    const locations = await stockLocationModule.listStockLocations(
      {},
      { take: 1 }
    )
    const location = locations?.[0]
    if (!location) {
      logger.warn(`Return ${rr.id}: no stock location — skipping restock`)
    } else {
      const variantIds = reqItems
        .map((i) => i.variant_id)
        .filter(Boolean) as string[]
      const adjustments: any[] = []
      if (variantIds.length) {
        const { data: variants } = await query.graph({
          entity: "product_variant",
          filters: { id: variantIds },
          fields: ["id", "inventory_items.inventory.id", "inventory_items.id"],
        })
        const variantInv = new Map<string, string[]>()
        for (const v of (variants as any[]) || []) {
          const ids = (v.inventory_items || [])
            .map((ii: any) => ii?.inventory?.id || ii?.id)
            .filter(Boolean)
          variantInv.set(v.id, ids)
        }
        for (const it of reqItems) {
          const invIds = variantInv.get(it.variant_id) || []
          for (const inventoryItemId of invIds) {
            adjustments.push({
              inventoryItemId,
              locationId: location.id,
              adjustment: Number(it.quantity || 0),
            })
          }
        }
      }
      if (adjustments.length) {
        await inventoryModule.adjustInventory(adjustments)
        restocked = true
        logger.info(
          `Return ${rr.id}: restocked ${adjustments.length} inventory entry(ies)`
        )
      } else {
        logger.warn(
          `Return ${rr.id}: no resolvable inventory items to restock`
        )
      }
    }
  } catch (e: any) {
    logger.error(`Return ${rr.id} restock failed: ${e.message}`)
  }

  // 3. Refund — find a captured online payment on the order, refund the
  // request's calculated amount against it
  const refundTarget = Number(rr.refund_amount || 0)
  let refundedAmount = 0
  let refundError: string | null = null

  if (refundTarget > 0) {
    const { data: orders } = await query.graph({
      entity: "order",
      filters: { id: rr.order_id },
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "shipping_address.first_name",
        "payment_collections.payments.id",
        "payment_collections.payments.amount",
        "payment_collections.payments.captured_at",
        "payment_collections.payments.provider_id",
      ],
    })
    const order = (orders as any[])?.[0]
    const payments = ((order?.payment_collections as any[]) || []).flatMap(
      (pc) => pc?.payments || []
    )
    const refundable = payments.find(
      (p) => p?.captured_at && isOnlineProvider(p?.provider_id)
    )
    if (refundable) {
      try {
        await refundPaymentWorkflow(container).run({
          input: {
            payment_id: refundable.id,
            amount: refundTarget,
            note: `Return request ${rr.id}`,
          } as any,
        })
        refundedAmount = refundTarget
        logger.info(
          `Return ${rr.id}: refunded ${refundedAmount} ${rr.currency_code}`
        )
      } catch (e: any) {
        refundError = e?.message || "Unknown refund error"
        logger.error(`Return ${rr.id} refund failed: ${refundError}`)
      }
    } else {
      logger.info(
        `Return ${rr.id}: no online captured payment — no refund (likely COD)`
      )
    }

    // 4. Mark + email — uses the order we just fetched
    const nowIso = new Date().toISOString()
    await returnModule.updateReturnRequests([
      {
        id: rr.id,
        status: "completed",
        processed_at: nowIso,
        refund_amount: refundedAmount || rr.refund_amount,
      },
    ])

    if (order?.email) {
      await emailService.sendReturnCompletedEmail({
        customer_email: order.email,
        customer_name:
          (order.shipping_address as any)?.first_name || "Customer",
        order_number: order.display_id,
        refund_amount: refundedAmount
          ? convertToLocale(refundedAmount, rr.currency_code)
          : null,
        is_prepaid: !!refundable,
        brand_name: process.env.BRAND_NAME || "Delfee",
      })
    }
  } else {
    // No refund amount — just mark completed (defensive)
    await returnModule.updateReturnRequests([
      {
        id: rr.id,
        status: "completed",
        processed_at: new Date().toISOString(),
      },
    ])
  }

  return {
    success: true,
    restocked,
    refunded: refundedAmount > 0,
    refundAmount: refundedAmount,
    refundError,
  }
}
