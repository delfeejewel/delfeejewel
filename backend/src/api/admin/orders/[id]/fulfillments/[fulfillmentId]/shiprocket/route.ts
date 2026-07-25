import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateFulfillmentWorkflow } from "@medusajs/medusa/core-flows"

import { actorHasPermission } from "../../../../../../../lib/rbac"

/**
 * POST /admin/orders/:id/fulfillments/:fulfillmentId/shiprocket
 * Body: { action: "assign_awb" | "generate_label" }
 *
 * Manual controls for the Shiprocket fulfillment provider: retry AWB
 * (courier waybill) assignment when the automatic attempt on fulfillment
 * creation failed, and (re)fetch the courier-compliant Shiprocket label PDF.
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

  if (action !== "assign_awb" && action !== "generate_label") {
    return res
      .status(400)
      .json({ message: 'action must be "assign_awb" or "generate_label"' })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Scope the fulfillment to this order — never trust fulfillmentId alone.
  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: [
      "id",
      "fulfillments.id",
      "fulfillments.provider_id",
      "fulfillments.data",
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
  const provider: any = req.scope.resolve("fp_shiprocket_shiprocket")

  try {
    if (action === "assign_awb") {
      if (data.awb_code) {
        return res.json({
          awb_code: data.awb_code,
          courier_name: data.courier_name || null,
        })
      }
      if (!data.shiprocket_shipment_id) {
        return res.status(400).json({
          message: "No Shiprocket shipment exists for this fulfillment",
        })
      }

      const awb = await provider.assignAwb(data.shiprocket_shipment_id)
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

      return res.json(awb)
    }

    // action === "generate_label"
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

    return res.json({ label_url: doc.label_url, tracking_url: trackingUrl })
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Shiprocket request failed" })
  }
}
