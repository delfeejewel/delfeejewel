import crypto from "crypto"

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  createShipmentWorkflow,
  updateFulfillmentWorkflow,
} from "@medusajs/medusa/core-flows"

import { processRtoRefund } from "../../../lib/process-rto-refund"
import { issueGiftCardsForOrder } from "../../../lib/issue-gift-cards"
import { SYSTEM_ACTOR, appendPackingHistory } from "../../../lib/packing-log"

/**
 * POST /hooks/shiprocket
 * Receives Shiprocket shipment status updates and records delivery state on
 * the matching Medusa order's metadata (shiprocket_status, delivered_at, awb).
 *
 * Shiprocket sends the channel order_id we passed at fulfillment time, which
 * is the Medusa order display_id — used here to match the order.
 *
 * Configure the webhook URL + token in the Shiprocket dashboard:
 *   Settings -> API -> Webhooks. The request must carry SHIPROCKET_WEBHOOK_TOKEN
 *   in the `x-api-key` header.
 */

/** Constant-time compare; false on any length/'type mismatch rather than throwing. */
function tokenMatches(provided: unknown, expected: string): boolean {
  if (typeof provided !== "string") return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/**
 * GET /hooks/shiprocket
 * Shiprocket's dashboard "Test Webhook" / reachability check probes the address
 * (a GET) before it POSTs. This route is otherwise POST-only, so that probe used
 * to 404 ("address not found"). Reply 200 so the dashboard test passes. Real
 * tracking updates always arrive as POST and are token-gated in POST below.
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  return res.status(200).json({ ok: true })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  // Money-moving actions (gift cards on "delivered", refunds on "RTO Delivered")
  // are gated on a valid token below — an unauthenticated caller can NEVER trigger
  // them. A missing server token is a misconfiguration, not permission to skip auth.
  const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN
  if (!expected) {
    logger.error(
      "Shiprocket webhook rejected: SHIPROCKET_WEBHOOK_TOKEN is not configured"
    )
    return res.status(503).json({ message: "Webhook not configured" })
  }
  // Shiprocket validates + tests the webhook by probing this URL WITHOUT the
  // token and requires a 2xx ("endpoint should be open access"). So we ACK an
  // unauthenticated request with 200 but do nothing — real status updates carry
  // the x-api-key and fall through to the guarded processing below. This keeps
  // the fail-closed guarantee for state changes while letting the dashboard save.
  if (!tokenMatches(req.headers["x-api-key"], expected)) {
    const raw = req.body as any
    const probe = Array.isArray(raw) ? raw[0] : raw
    const looksLikeStatus =
      probe != null &&
      (probe.order_id != null ||
        probe.awb != null ||
        probe.current_status != null ||
        probe.shipment_status != null)
    if (looksLikeStatus) {
      // A real-looking status update arrived without a valid token — dropped, not
      // acted on. If this ever logs in prod, the dashboard token is misconfigured.
      logger.warn(
        "Shiprocket webhook: DROPPED a status payload with bad/missing x-api-key"
      )
    } else {
      logger.info("Shiprocket webhook: reachability probe (no token) acknowledged")
    }
    return res.status(200).json({ received: true, authenticated: false })
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
    const isPickedUp =
      (sLowerEarly.includes("picked up") || sLowerEarly.includes("in transit")) &&
      !sLowerEarly.includes("rto")
    // Pickup can get scheduled OUTSIDE our own "Request Pickup" button — e.g.
    // an admin reassigns the courier directly on Shiprocket's dashboard after
    // a pickup error, which schedules a fresh pickup without ever calling our
    // requestPickup(). The Packing widget's "Pickup requested" checkbox only
    // reflects OUR own API call, so without this it stays stuck showing
    // "Shiprocket didn't confirm the pickup request" even once Shiprocket has
    // genuinely scheduled one. Exclude error/exception/cancelled variants —
    // those are the opposite of a real schedule.
    const isPickupScheduled =
      sLowerEarly.includes("pickup") &&
      (sLowerEarly.includes("scheduled") || sLowerEarly.includes("generated")) &&
      !sLowerEarly.includes("error") &&
      !sLowerEarly.includes("exception") &&
      !sLowerEarly.includes("cancel")
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

    // On delivery, issue any purchased gift cards that were deferred because
    // the order wasn't paid at placement (COD). Idempotent + payment-gated;
    // a no-op for orders without gift cards or already-issued ones.
    if (isDelivered) {
      try {
        await issueGiftCardsForOrder(req.scope as any, order.id)
      } catch (e: any) {
        logger.error(
          `Shiprocket webhook: gift-card issuance failed for #${orderRef}: ${e?.message}`
        )
      }
    }

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

    // Pickup-scheduled sync, AWB-change sync, and auto mark-shipped all need
    // the same fresh fulfillment snapshot — one query instead of three, and
    // guarantees all three see a consistent view instead of racing separate
    // reads. Best-effort throughout: never blocks the webhook ack.
    if (isPickupScheduled || isPickedUp || (awb && !isDelivered)) {
      try {
        const packingQuery = req.scope.resolve(ContainerRegistrationKeys.QUERY)
        const { data: withFulfillments } = await packingQuery.graph({
          entity: "order",
          filters: { id: order.id },
          fields: [
            "id",
            "metadata",
            "fulfillments.id",
            "fulfillments.provider_id",
            "fulfillments.data",
            "fulfillments.shipped_at",
          ],
        })
        const freshOrder = (withFulfillments as any[])?.[0]
        const shiprocketFulfillment = (
          (freshOrder?.fulfillments as any[]) || []
        ).find((f: any) => (f.provider_id || "").startsWith("shiprocket"))
        const fData = (shiprocketFulfillment?.data || {}) as any
        const packing = (freshOrder?.metadata as any)?.packing

        const logPackingStep = async (step: string, extra: Record<string, any> = {}) => {
          if (!packing) return
          await orderModule.updateOrders(order.id, {
            metadata: {
              ...(freshOrder.metadata as any),
              packing: {
                ...packing,
                history: appendPackingHistory(packing, {
                  step,
                  ...SYSTEM_ACTOR,
                  ...extra,
                }),
              },
            },
          })
        }

        if (shiprocketFulfillment) {
          // Courier reassignment changes the AWB itself (proven: a real
          // reassignment moved 7D136602671 → 371238957771) — the label PDF
          // we have on file was generated for the OLD AWB and is now
          // invalid. Clear it so the Packing widget shows "Print label"
          // again instead of a stale "Reprint" link; awb_code/courier_name
          // are updated to match reality either way. Re-generating the PDF
          // automatically isn't safe here — Shiprocket's label API needs the
          // shipment_id, which this webhook payload doesn't carry, and that
          // may have changed too — so this only clears the stale one rather
          // than guessing at a replacement.
          const awbChanged = !!(awb && fData.awb_code && awb !== fData.awb_code)
          if (awbChanged) {
            await updateFulfillmentWorkflow(req.scope).run({
              input: {
                id: shiprocketFulfillment.id,
                data: { ...fData, awb_code: awb, courier_name: courierName || fData.courier_name },
                labels: [],
              } as any,
            })
            await logPackingStep("awb_changed", {
              previous_awb_code: fData.awb_code,
              new_awb_code: awb,
            })
            logger.warn(
              `Shiprocket webhook: order #${orderRef} AWB changed ${fData.awb_code} → ${awb} ` +
                `(courier reassigned) — cleared the now-invalid label, reprint required`
            )
          }

          // Shiprocket confirmed a pickup schedule (however it got
          // triggered) → sync the Packing widget's local flag so it stops
          // claiming the request was never confirmed.
          if (isPickupScheduled && !fData.pickup_requested_at) {
            await updateFulfillmentWorkflow(req.scope).run({
              input: {
                id: shiprocketFulfillment.id,
                data: {
                  ...fData,
                  awb_code: awbChanged ? awb : fData.awb_code,
                  courier_name: awbChanged ? courierName || fData.courier_name : fData.courier_name,
                  pickup_requested_at: nowIso,
                  pickup_scheduled_date:
                    payload?.pickup_scheduled_date ||
                    payload?.etd ||
                    fData.pickup_scheduled_date ||
                    null,
                },
              } as any,
            })
            await logPackingStep("pickup_requested")
          }

          // Courier actually picked up the package → stamp the real
          // fulfillment.shipped_at, same as the Packing page's manual fallback.
          if (isPickedUp && !shiprocketFulfillment.shipped_at) {
            await createShipmentWorkflow(req.scope).run({
              input: { id: shiprocketFulfillment.id } as any,
            })
            await logPackingStep("shipped")
          }
        }
      } catch (e: any) {
        logger.error(
          `Shiprocket webhook: fulfillment sync failed for #${orderRef}: ${e?.message}`
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
