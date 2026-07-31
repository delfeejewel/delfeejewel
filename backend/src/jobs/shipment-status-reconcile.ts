import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { resolveShiprocketProvider } from "../lib/shiprocket-provider"
import {
  applyShipmentStatus,
  isTerminalStatus,
} from "../lib/shipment-status"

/**
 * Pulls shipment status for every in-flight parcel and corrects drift.
 *
 * The webhook is the primary source, but webhook delivery is not guaranteed:
 * a dropped call, a deploy at the wrong moment, or a signature mismatch and the
 * order sits on "Out for delivery" forever — the customer's tracking page goes
 * stale, and `delivered_at` never gets set, which silently breaks the returns
 * window and any delivery-triggered work.
 *
 * Only non-terminal shipments are polled (delivered / RTO / cancelled are
 * done), so this costs one call per parcel actually in transit.
 *
 * Runs every 6 hours — often enough that a missed webhook is corrected the same
 * day, rare enough to stay well inside Shiprocket's rate limits.
 */
export default async function shipmentStatusReconcileJob(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data: orders } = await query.graph({
      entity: "order",
      filters: {} as any,
      fields: [
        "id",
        "display_id",
        "metadata",
        "fulfillments.data",
        "fulfillments.canceled_at",
      ],
    })

    const inFlight = ((orders as any[]) || [])
      .map((o) => {
        const meta = (o.metadata as any) || {}
        const awb =
          ((o.fulfillments as any[]) || [])
            .filter((f) => !f.canceled_at)
            .map((f) => f?.data?.awb_code)
            .find(Boolean) || meta.awb || null
        return { id: o.id, display_id: o.display_id, awb, status: meta.shiprocket_status }
      })
      .filter((o) => o.awb && !isTerminalStatus(o.status))

    if (!inFlight.length) {
      logger.info("Shipment reconcile: nothing in flight.")
      return
    }

    const provider: any = resolveShiprocketProvider(container as any)

    let checked = 0
    let updated = 0
    let failed = 0

    for (const o of inFlight) {
      try {
        const tracked = await provider.trackByAwb(o.awb!)
        checked++
        if (!tracked?.status) continue

        const result = await applyShipmentStatus(container as any, o.id, {
          status: tracked.status,
          courier_name: tracked.courier_name,
          awb: o.awb,
          activities: tracked.history,
        })

        if (result.changed) {
          updated++
          logger.info(
            `Shipment reconcile: order #${o.display_id} "${o.status ?? "—"}" → "${tracked.status}" ` +
              `(webhook missed this)`
          )
        }
      } catch (e: any) {
        failed++
        logger.warn(
          `Shipment reconcile: could not track AWB ${o.awb} for order #${o.display_id}: ${e?.message}`
        )
      }
    }

    logger.info(
      `Shipment reconcile: ${checked} checked, ${updated} corrected, ${failed} failed.`
    )
  } catch (e: any) {
    logger.error(`Shipment reconcile job failed: ${e?.message}`)
  }
}

export const config = {
  name: "shipment-status-reconcile",
  schedule: "0 */6 * * *", // every 6 hours
}
