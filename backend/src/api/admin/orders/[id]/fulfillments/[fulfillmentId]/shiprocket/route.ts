import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateFulfillmentWorkflow } from "@medusajs/medusa/core-flows"

import { actorHasPermission } from "../../../../../../../lib/rbac"
import { resolveActor, appendPackingHistory } from "../../../../../../../lib/packing-log"
import { resolveShiprocketProvider } from "../../../../../../../lib/shiprocket-provider"

/**
 * POST /admin/orders/:id/fulfillments/:fulfillmentId/shiprocket
 * Body: { action: "assign_awb" | "generate_label" | "request_pickup" | "reset_shipment" }
 *
 * Manual controls for the Shiprocket fulfillment provider: retry AWB
 * (courier waybill) assignment when the automatic attempt on fulfillment
 * creation failed, (re)fetch the courier-compliant Shiprocket label PDF,
 * request/re-request pickup, and undo a mistaken AWB/ready-to-ship (before
 * it's actually shipped) without cancelling the whole order. Every
 * successful action here is also logged to the order's packing audit trail
 * (who, what, when) if a packing session exists for this order.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  // Guarded here, not in middleware: requirePermission fails OPEN when it
  // can't resolve actor_id, and this endpoint talks to the courier.
  if (!(await actorHasPermission(req, "shipping.write"))) {
    return res.status(403).json({ message: "Forbidden" })
  }

  const orderId = req.params.id
  const fulfillmentId = req.params.fulfillmentId
  const { action } = (req.body || {}) as { action?: string }

  const VALID_ACTIONS = ["assign_awb", "generate_label", "request_pickup", "reset_shipment"]
  if (!action || !VALID_ACTIONS.includes(action)) {
    return res.status(400).json({
      message: 'action must be "assign_awb", "generate_label", "request_pickup", or "reset_shipment"',
    })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Scope the fulfillment to this order — never trust fulfillmentId alone.
  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: [
      "id",
      "display_id",
      "email",
      "total",
      "shipping_total",
      "discount_total",
      "metadata",
      "shipping_address.*",
      // "items.*" (not a narrow field subset) — Medusa only computes
      // per-item totals (discount_total, tax_total — needed below for the
      // real per-line discount/tax) when the full item graph is loaded;
      // see utils/order-lookup.ts. items.tax_lines.rate is what makes
      // tax_total compute at all, same as core's create-fulfillment workflow.
      "items.*",
      "items.tax_lines.rate",
      "items.detail.quantity",
      "fulfillments.id",
      "fulfillments.provider_id",
      "fulfillments.data",
      "fulfillments.shipped_at",
    ],
  })
  const order = (orders as any[])?.[0]
  const fulfillment = ((order?.fulfillments as any[]) || []).find(
    (f) => f.id === fulfillmentId
  )
  if (!fulfillment || !(fulfillment.provider_id || "").startsWith("shiprocket")) {
    return res
      .status(404)
      .json({ message: "Shiprocket fulfillment not found on this order" })
  }

  const data = (fulfillment.data || {}) as any
  const provider: any = resolveShiprocketProvider(req.scope)

  /** Logs this action to the order's packing audit trail, if a packing
   *  session exists — a no-op otherwise (this route is also reachable
   *  outside the packing checklist). Best-effort: never fails the request. */
  const logStep = async (step: string, extra: Record<string, any> = {}) => {
    try {
      const prevMeta = (order.metadata as any) || {}
      const packing = prevMeta.packing
      if (!packing) return
      const actor = await resolveActor(req.scope, (req as any).auth_context)
      const orderModule: any = req.scope.resolve(Modules.ORDER)
      await orderModule.updateOrders([
        {
          id: orderId,
          metadata: {
            ...prevMeta,
            packing: {
              ...packing,
              history: appendPackingHistory(packing, { step, ...actor, ...extra }),
            },
          },
        },
      ])
    } catch {
      // Audit trail is best-effort — never block the actual courier action on it.
    }
  }

  /** Creates a brand-new Shiprocket order + shipment for this fulfillment
   *  and persists the new identifiers, replacing whatever stale ones were
   *  stored before (e.g. a shipment whose AWB was cancelled — Shiprocket
   *  refuses to assign a new AWB to that same shipment_id).
   *
   *  Shiprocket keys new-order creation off order_id as OUR merchant
   *  reference — resending the same one just hands back the existing
   *  (possibly cancelled) order/shipment instead of making a new one. So
   *  every creation attempt for this fulfillment is numbered via a counter
   *  persisted on its own data (survives resets): attempt 1 uses the plain
   *  order display_id (unchanged, common-case behaviour); attempt 2+ (a
   *  retry after a cancellation, self-heal, or explicit reset) appends
   *  `-R<n>` so Shiprocket is guaranteed to see a fresh reference. */
  const createFreshShipment = async () => {
    const attempt = (data.shiprocket_attempt || 0) + 1
    const orderIdOverride = attempt > 1 ? `${order.display_id}-R${attempt}` : undefined
    const created = await provider.createOrderForFulfillment(
      order,
      order.items || [],
      fulfillmentId,
      orderIdOverride
    )
    data.shiprocket_order_id = created.order_id
    data.shiprocket_shipment_id = created.shipment_id
    data.shiprocket_attempt = attempt
    delete data.awb_code
    delete data.courier_name
    await updateFulfillmentWorkflow(req.scope).run({
      input: { id: fulfillmentId, data: { ...data } } as any,
    })
    await logStep("shiprocket_order_created", { attempt })
  }

  try {
    if (action === "assign_awb") {
      if (data.awb_code) {
        return res.json({
          awb_code: data.awb_code,
          courier_name: data.courier_name || null,
        })
      }
      if (!data.shiprocket_shipment_id) {
        // The initial order creation (at "Start Packing") didn't produce a
        // shipment — try again now rather than leaving this permanently
        // stuck. If Shiprocket still rejects it, the real reason comes back
        // in the error message this time instead of a generic "missing".
        try {
          await createFreshShipment()
        } catch (e: any) {
          return res.status(502).json({
            message:
              e?.message ||
              "Shiprocket still did not create a shipment for this order.",
          })
        }
      }

      let awb: { awb_code: string | null; courier_name: string | null }
      try {
        awb = await provider.assignAwb(data.shiprocket_shipment_id)
      } catch (e: any) {
        // The stored shipment_id can be left over from a shipment whose AWB
        // was since cancelled (e.g. cancelling the order/label voids the
        // Shiprocket shipment, but never clears these ids off the
        // fulfillment) — Shiprocket then refuses to assign a fresh AWB to
        // that same shipment_id. Self-heal by creating a new shipment and
        // retrying once, same as the "no shipment yet" branch above.
        if (!/already assigned/i.test(e?.message || "")) {
          throw e
        }
        try {
          await createFreshShipment()
        } catch (createErr: any) {
          return res.status(502).json({
            message:
              createErr?.message ||
              "Shiprocket still did not create a shipment for this order.",
          })
        }
        awb = await provider.assignAwb(data.shiprocket_shipment_id)
      }
      if (!awb.awb_code) {
        return res.status(502).json({
          message:
            "Shiprocket could not assign a courier — check serviceability for this pincode.",
        })
      }

      await updateFulfillmentWorkflow(req.scope).run({
        input: {
          id: fulfillmentId,
          data: { ...data, awb_code: awb.awb_code, courier_name: awb.courier_name },
        } as any,
      })
      await logStep("awb_assigned", { awb_code: awb.awb_code })

      return res.json(awb)
    }

    if (action === "generate_label") {
      if (!data.awb_code) {
        return res
          .status(400)
          .json({ message: "Assign AWB before generating a label" })
      }

      const doc = await provider.getFulfillmentDocuments({
        shiprocket_shipment_id: data.shiprocket_shipment_id,
      })
      if (!doc?.label_url) {
        return res
          .status(502)
          .json({ message: "Shiprocket did not return a label" })
      }

      const trackingUrl = `https://www.shiprocket.in/tracking/${data.awb_code}`
      await updateFulfillmentWorkflow(req.scope).run({
        input: {
          id: fulfillmentId,
          labels: [
            {
              tracking_number: data.awb_code,
              tracking_url: trackingUrl,
              label_url: doc.label_url,
            },
          ],
        } as any,
      })
      await logStep("label_printed")

      return res.json({ label_url: doc.label_url, tracking_url: trackingUrl })
    }

    if (action === "request_pickup") {
      if (!data.shiprocket_shipment_id) {
        return res.status(400).json({
          message: "No Shiprocket shipment exists for this fulfillment",
        })
      }

      const pickup = await provider.requestPickup(data.shiprocket_shipment_id)
      if (!pickup.requested) {
        await logStep("pickup_request_failed")
        return res.status(502).json({
          message: "Shiprocket did not confirm the pickup request — try again shortly.",
        })
      }

      await updateFulfillmentWorkflow(req.scope).run({
        input: {
          id: fulfillmentId,
          data: {
            ...data,
            pickup_requested_at: new Date().toISOString(),
            pickup_scheduled_date: pickup.pickup_scheduled_date,
          },
        } as any,
      })
      await logStep("pickup_requested", {
        pickup_scheduled_date: pickup.pickup_scheduled_date,
      })

      return res.json(pickup)
    }

    // action === "reset_shipment"
    // Undo a mistaken AWB assignment / "ready to ship" mark — voids the
    // Shiprocket shipment and clears everything back to a clean packing
    // state, WITHOUT touching the Medusa order/fulfillment itself or any
    // payment (unlike "Cancel Order"). Only safe before the parcel has
    // actually been marked shipped.
    if (fulfillment.shipped_at) {
      return res.status(400).json({
        message: "This fulfillment has already shipped — it can't be reset here.",
      })
    }

    const previousAwbCode = data.awb_code || null
    const previousShiprocketOrderId = data.shiprocket_order_id || null

    if (data.shiprocket_order_id) {
      try {
        await provider.cancelFulfillment(data)
      } catch (e: any) {
        return res.status(502).json({
          message:
            e?.message ||
            "Shiprocket did not cancel this shipment — it may already be in transit.",
        })
      }
    }

    delete data.shiprocket_order_id
    delete data.shiprocket_shipment_id
    delete data.awb_code
    delete data.courier_name
    delete data.pickup_requested_at
    delete data.pickup_scheduled_date
    // shiprocket_attempt is intentionally kept — it's what keeps the next
    // createFreshShipment() call from getting handed back this same
    // (now-cancelled) Shiprocket order again.

    await updateFulfillmentWorkflow(req.scope).run({
      input: { id: fulfillmentId, data: { ...data }, labels: [] } as any,
    })

    try {
      const prevMeta = (order.metadata as any) || {}
      const packing = prevMeta.packing
      if (packing) {
        const actor = await resolveActor(req.scope, (req as any).auth_context)
        const orderModule: any = req.scope.resolve(Modules.ORDER)
        await orderModule.updateOrders([
          {
            id: orderId,
            metadata: {
              ...prevMeta,
              packing: {
                ...packing,
                ready_to_ship_at: null,
                history: appendPackingHistory(packing, {
                  step: "shipment_reset",
                  ...actor,
                  previous_awb_code: previousAwbCode,
                  previous_shiprocket_order_id: previousShiprocketOrderId,
                }),
              },
            },
          },
        ])
      }
    } catch {
      // Audit trail is best-effort — the actual reset above already succeeded.
    }

    return res.json({ reset: true })
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Shiprocket request failed" })
  }
}
