import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { actorHasPermission } from "../../../../lib/rbac"
import { resolveShiprocketProvider } from "../../../../lib/shiprocket-provider"

/**
 * GET  /admin/shiprocket/manifest  → shipments awaiting pickup (the batch)
 * POST /admin/shiprocket/manifest  → generate/print the manifest for them
 *
 * A manifest is the handover document the courier signs, covering a PICKUP
 * BATCH — every parcel going out together — not a single order. That is why it
 * lives here rather than under /orders/:id, even though the button appears on
 * the order page: clicking it from one order still produces the document for
 * the whole batch, and the UI says so.
 *
 * It is deliberately NOT a required step. Nothing gates dispatch on it: a
 * manifest is proof of handover, useful when a courier later claims a parcel
 * was never collected. Making it mandatory would stall single-order days for a
 * document nobody asked for.
 */

/** Pickup requested, not yet shipped/delivered — i.e. still on the bench. */
function awaitingPickup(order: any): boolean {
  const meta = (order.metadata as any) || {}
  const status = String(meta.shiprocket_status || "").toLowerCase()
  if (status.includes("delivered") || status.includes("rto")) return false

  return ((order.fulfillments as any[]) || []).some(
    (f) =>
      !f.canceled_at &&
      !f.shipped_at &&
      f?.data?.awb_code &&
      f?.data?.pickup_requested_at
  )
}

async function collectBatch(req: AuthenticatedMedusaRequest) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    filters: {} as any,
    fields: [
      "id",
      "display_id",
      "metadata",
      "fulfillments.id",
      "fulfillments.data",
      "fulfillments.shipped_at",
      "fulfillments.canceled_at",
    ],
  })

  return ((orders as any[]) || [])
    .filter(awaitingPickup)
    .map((o) => {
      const f = ((o.fulfillments as any[]) || []).find(
        (x) => !x.canceled_at && x?.data?.awb_code
      )
      return {
        order_id: o.id,
        display_id: o.display_id,
        awb: f?.data?.awb_code ?? null,
        courier: f?.data?.courier_name ?? null,
        shipment_id: f?.data?.shiprocket_shipment_id ?? null,
        shiprocket_order_id: f?.data?.shiprocket_order_id ?? null,
        manifest_url: f?.data?.manifest_url ?? null,
      }
    })
    .filter((s) => s.shipment_id)
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!(await actorHasPermission(req, "shipping.write"))) {
    return res.status(403).json({ message: "Forbidden" })
  }

  const batch = await collectBatch(req)
  return res.json({
    count: batch.length,
    shipments: batch,
    already_generated: batch.filter((s) => s.manifest_url).length,
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!(await actorHasPermission(req, "shipping.write"))) {
    return res.status(403).json({ message: "Forbidden" })
  }

  const { reprint } = (req.body || {}) as { reprint?: boolean }

  const batch = await collectBatch(req)
  if (!batch.length) {
    return res.status(400).json({
      message:
        "No shipments are awaiting pickup — a manifest covers parcels that have an AWB and a requested pickup.",
    })
  }

  const provider: any = resolveShiprocketProvider(req.scope)

  try {
    const result = reprint
      ? await provider.printManifest(
          batch.map((s) => s.shiprocket_order_id).filter(Boolean)
        )
      : await provider.generateManifest(batch.map((s) => s.shipment_id))

    if (!result?.manifest_url) {
      return res.status(502).json({
        message:
          "Shiprocket accepted the request but returned no manifest document. Try Reprint in a moment.",
      })
    }

    // Stamp it on every fulfillment in the batch so it can be reprinted later
    // without regenerating (regenerating can invalidate the signed copy).
    const fulfillmentModule: any = req.scope.resolve(Modules.FULFILLMENT)
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const stampedAt = new Date().toISOString()

    for (const s of batch) {
      try {
        const { data: orders } = await query.graph({
          entity: "order",
          filters: { id: s.order_id } as any,
          fields: ["id", "fulfillments.id", "fulfillments.data"],
        })
        const f = (((orders as any[])[0]?.fulfillments as any[]) || []).find(
          (x) => x?.data?.awb_code === s.awb
        )
        if (!f) continue
        await fulfillmentModule.updateFulfillment(f.id, {
          data: {
            ...(f.data || {}),
            manifest_url: result.manifest_url,
            manifest_generated_at: stampedAt,
          },
        })
      } catch {
        // One fulfillment failing to record the url must not lose the manifest
        // for the rest of the batch — the document itself is already generated.
      }
    }

    return res.json({
      manifest_url: result.manifest_url,
      count: batch.length,
      display_ids: batch.map((s) => s.display_id),
    })
  } catch (e: any) {
    return res.status(502).json({
      message: e?.message || "Shiprocket could not generate the manifest.",
    })
  }
}
