import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { QR_CODE_MODULE } from "../../../../modules/qr_code"

/**
 * GET /store/qr-verify/:code
 * Public authenticity-verification endpoint. Scanning the QR on a jewellery
 * piece's tag lands here; returns the linked product/variant info so the
 * storefront can render a "Verified Genuine" page.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const code = String(req.params.code || "").toUpperCase().trim()
  if (!code) {
    return res.status(400).json({ verified: false, message: "Code is required." })
  }

  const qrModule: any = req.scope.resolve(QR_CODE_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const [qr] = await qrModule.listQrCodes({ code })
  if (!qr || qr.status !== "active") {
    return res
      .status(404)
      .json({ verified: false, message: "This code isn't valid." })
  }

  const { data: variants } = await query.graph({
    entity: "product_variant",
    filters: { id: qr.variant_id },
    fields: [
      "id",
      "title",
      "sku",
      "product.id",
      "product.title",
      "product.handle",
      "product.description",
      "product.thumbnail",
      "product.material",
      "product.metadata",
    ],
  })
  const variant = (variants as any[])?.[0]
  if (!variant?.product) {
    return res
      .status(404)
      .json({ verified: false, message: "Product info unavailable." })
  }

  const p = variant.product
  return res.json({
    verified: true,
    code: qr.code,
    product: {
      id: p.id,
      title: p.title,
      handle: p.handle,
      description: p.description || null,
      thumbnail: p.thumbnail || null,
      material: p.material || (p.metadata as any)?.metal || null,
      metadata: p.metadata || {},
    },
    variant: {
      id: variant.id,
      title: variant.title,
      sku: variant.sku || qr.sku || null,
    },
  })
}
