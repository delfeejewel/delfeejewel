import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { processRtoRefund } from "../../../lib/process-rto-refund"

/**
 * POST /hooks/shiprocket
 * Receives Shiprocket shipment status updates and records delivery state on
 * the matching Medusa order's metadata (shiprocket_status, delivered_at, awb).
 *
 * Shiprocket sends the channel order_id we passed at fulfillment time, which
 * is the Medusa order display_id — used here to match the order.
 *
 * Configure the webhook URL + (optional) token in the Shiprocket dashboard:
 *   Settings -> API -> Webhooks.  If SHIPROCKET_WEBHOOK_TOKEN is set, the
 *   request must carry it in the `x-api-key` header.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN
  if (expected && req.headers["x-api-key"] !== expected) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  try {
    const raw = req.body as any
    const payload = Array.isArray(raw) ? raw[0] : raw

    const awb = payload?.awb ? String(payload.awb) : null
    const status = String(
      payload?.current_status ?? payload?.shipment_status ?? ""
    ).trim()
    const orderRef =
      payload?.order_id != null ? String(payload.order_id) : ""

    if (!orderRef) {
      logger.warn("Shiprocket webhook: payload had no order_id")
      return res.status(200).json({ received: true, matched: false })
    }

    const orderModule: any = req.scope.resolve(Modules.ORDER)
    const displayId = Number(orderRef)
    const orders = Number.isNaN(displayId)
      ? []
      : await orderModule.listOrders(
          { display_id: displayId },
          { take: 1 }
        )
    const order = orders?.[0]

    if (!order) {
      logger.warn(`Shiprocket webhook: no order for display_id ${orderRef}`)
      return res.status(200).json({ received: true, matched: false })
    }

    const sLowerEarly = status.toLowerCase()
    const isDelivered =
      sLowerEarly.includes("delivered") && !sLowerEarly.includes("rto")
    const nowIso = new Date().toISOString()
    const courierName =
      payload?.courier_name || payload?.courier || null

    const prevMeta = (order.metadata as any) || {}
    const prevHistory: Array<any> = Array.isArray(prevMeta.shiprocket_history)
      ? prevMeta.shiprocket_history
      : []
    // Append only if status actually changed from the previous entry
    const lastStatus = prevHistory.at(-1)?.status
    const history =
      status && status !== lastStatus
        ? [...prevHistory, { status, at: nowIso, courier: courierName }]
        : prevHistory

    const metadata: Record<string, any> = {
      ...prevMeta,
      shiprocket_status: status || prevMeta.shiprocket_status,
      shiprocket_status_at: nowIso,
      shiprocket_history: history,
    }
    if (awb) metadata.awb = awb
    if (courierName) metadata.shiprocket_courier = courierName
    if (isDelivered && !metadata.delivered_at) {
      metadata.delivered_at = nowIso
    }

    await orderModule.updateOrders(order.id, { metadata })

    logger.info(
      `Shiprocket webhook: order #${orderRef} status="${status}" delivered=${isDelivered}`
    )

    // RTO Delivered = parcel back at warehouse → process refund + restock.
    // Idempotency is enforced inside processRtoRefund.
    const isRtoDelivered =
      sLowerEarly.includes("rto") && sLowerEarly.includes("delivered")
    if (isRtoDelivered) {
      try {
        await processRtoRefund(order.id, req.scope as any)
      } catch (e: any) {
        logger.error(
          `RTO processor failed for order #${orderRef}: ${e?.message}`
        )
      }
    }

    return res.status(200).json({
      received: true,
      matched: true,
      delivered: isDelivered,
      rto_processed: isRtoDelivered,
    })
  } catch (e: any) {
    logger.error(`Shiprocket webhook error: ${e?.message}`)
    return res.status(200).json({ received: true, error: true })
  }
}
