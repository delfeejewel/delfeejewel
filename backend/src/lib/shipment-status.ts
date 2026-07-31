import { Modules } from "@medusajs/framework/utils"

/**
 * One place that decides what a Shiprocket status MEANS and writes it onto the
 * order.
 *
 * Three things update shipment status — the webhook, the dispatch panel's
 * Refresh button, and the nightly reconciliation job. They must agree on what
 * counts as "delivered", how history is appended, and that `delivered_at` is
 * never overwritten; three copies of that logic would drift and the customer's
 * tracking page would contradict the admin.
 */

export type StatusUpdate = {
  status: string | null
  courier_name?: string | null
  awb?: string | null
  /** Carrier-side history, when we pulled it (Refresh / reconciliation). */
  activities?: Array<{ status: string; at?: string | null; location?: string | null }>
}

export type StatusResult = {
  changed: boolean
  status: string | null
  delivered: boolean
  was_already_delivered: boolean
}

const lower = (s?: string | null) => String(s || "").toLowerCase()

export const isDeliveredStatus = (s?: string | null) =>
  lower(s).includes("delivered") && !lower(s).includes("rto")

export const isRtoStatus = (s?: string | null) => lower(s).includes("rto")

/** Terminal states — the reconciliation job stops polling these. */
export const isTerminalStatus = (s?: string | null) =>
  isDeliveredStatus(s) ||
  isRtoStatus(s) ||
  lower(s).includes("canceled") ||
  lower(s).includes("cancelled")

export async function applyShipmentStatus(
  scope: any,
  orderId: string,
  update: StatusUpdate
): Promise<StatusResult> {
  const orderModule: any = scope.resolve(Modules.ORDER)
  const [order] = await orderModule.listOrders({ id: orderId }, { take: 1 })
  if (!order) {
    return { changed: false, status: null, delivered: false, was_already_delivered: false }
  }

  const prevMeta = (order.metadata as any) || {}
  const prevHistory: any[] = Array.isArray(prevMeta.shiprocket_history)
    ? prevMeta.shiprocket_history
    : []

  const nowIso = new Date().toISOString()
  const status = update.status || prevMeta.shiprocket_status || null
  const wasDelivered = !!prevMeta.delivered_at

  // Append only on an actual change. Shiprocket repeats the same status on
  // every poll, and an entry per poll would bury the real transitions.
  const lastStatus = prevHistory.at(-1)?.status
  const changed = !!update.status && update.status !== lastStatus

  const history = changed
    ? [
        ...prevHistory,
        {
          status: update.status,
          at: nowIso,
          courier: update.courier_name ?? prevMeta.shiprocket_courier ?? null,
        },
      ]
    : prevHistory

  const metadata: Record<string, any> = {
    ...prevMeta,
    shiprocket_status: status,
    shiprocket_status_at: nowIso,
    shiprocket_history: history,
  }

  if (update.awb) metadata.awb = update.awb
  if (update.courier_name) metadata.shiprocket_courier = update.courier_name

  // Carrier-side scan history, when we have it. Kept separate from our own
  // status history so a pull never rewrites what the webhook recorded.
  if (update.activities?.length) {
    metadata.shiprocket_activities = update.activities
  }

  // Never overwrite once set: a status that regresses (Delivered → In transit,
  // which Shiprocket does emit) must not erase the delivery timestamp that
  // returns windows and refunds are calculated from.
  if (isDeliveredStatus(update.status) && !metadata.delivered_at) {
    metadata.delivered_at = nowIso
  }

  await orderModule.updateOrders(order.id, { metadata })

  return {
    changed,
    status,
    delivered: isDeliveredStatus(status),
    was_already_delivered: wasDelivered,
  }
}
