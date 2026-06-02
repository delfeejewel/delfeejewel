import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Pushes a synthetic Shiprocket status event onto an order — same shape the
 * webhook would write, so the timeline on /track-order and the account order
 * details renders the new step.
 *
 * Usage:
 *   npx medusa exec ./src/scripts/bump-order-status.ts <display_id> "<status>"
 *
 * Examples:
 *   ... 5 "Picked Up"
 *   ... 5 "In Transit"
 *   ... 5 "Out for Delivery"
 *   ... 5 "Delivered"
 */
export default async function bumpStatus({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orderModule: any = container.resolve(Modules.ORDER)

  const displayId = Number(args?.[0])
  const status = (args?.[1] || "In Transit").trim()

  if (!Number.isInteger(displayId) || displayId <= 0) {
    logger.error('Usage: ... <display_id> "<status>"')
    return
  }

  const [order] = await orderModule.listOrders(
    { display_id: displayId },
    { take: 1 }
  )
  if (!order) {
    logger.error(`No order with display_id ${displayId}`)
    return
  }

  const nowIso = new Date().toISOString()
  const isDelivered = status.toLowerCase().includes("delivered")
  const prev = (order.metadata || {}) as any
  const history: Array<any> = Array.isArray(prev.shiprocket_history)
    ? prev.shiprocket_history
    : []
  const last = history.at(-1)?.status
  const newHistory =
    status !== last
      ? [...history, { status, at: nowIso, courier: "Demo Courier" }]
      : history

  const metadata: any = {
    ...prev,
    shiprocket_status: status,
    shiprocket_status_at: nowIso,
    shiprocket_history: newHistory,
    awb: prev.awb || "DEMO-AWB-1001",
    shiprocket_courier: "Demo Courier",
  }
  if (isDelivered && !metadata.delivered_at) {
    metadata.delivered_at = nowIso
  }

  await orderModule.updateOrders(order.id, { metadata })
  logger.info(
    `Bumped order #${displayId} → "${status}" (history length: ${newHistory.length})`
  )
}
