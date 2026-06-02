import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import QRCode from "qrcode"

import { QR_CODE_MODULE } from "../../../../modules/qr_code"

const STOREFRONT =
  process.env.STOREFRONT_URL || "http://localhost:8000"

/**
 * GET /admin/qr-codes/labels?product_id=...&country=in
 * Returns a print-optimised HTML page with QR labels in a grid. Each QR
 * encodes the public verify URL for that code. Admin opens this in a
 * browser and prints to label paper / saves as PDF.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const qrModule: any = req.scope.resolve(QR_CODE_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const productId = req.query.product_id as string | undefined
  const country = (req.query.country as string) || "in"

  const filters: any = { status: "active" }
  if (productId) filters.product_id = productId
  const qrCodes = await qrModule.listQrCodes(filters)

  if (!qrCodes?.length) {
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    return res.send(
      `<!doctype html><meta charset="utf-8"><title>Labels</title><body style="font-family:system-ui;padding:40px;color:#666"><h1>No labels to print</h1><p>No QR codes match this filter.</p></body>`
    )
  }

  const variantIds = qrCodes.map((q: any) => q.variant_id)
  const { data: variants } = await query.graph({
    entity: "product_variant",
    filters: { id: variantIds },
    fields: ["id", "title", "sku", "product.title"],
  })
  const variantById = new Map(
    ((variants as any[]) || []).map((v: any) => [v.id, v])
  )

  const labels = await Promise.all(
    qrCodes.map(async (qc: any) => {
      const verifyUrl = `${STOREFRONT}/${country}/verify/${qc.code}`
      const svg = await QRCode.toString(verifyUrl, {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
        color: { dark: "#1a1a1a", light: "#ffffff" },
      })
      const v: any = variantById.get(qc.variant_id) || {}
      const productTitle = v?.product?.title || "Product"
      const variantTitle = v?.title || ""
      const sku = qc.sku || v?.sku || qc.code
      return { qc, verifyUrl, svg, productTitle, variantTitle, sku }
    })
  )

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>QR Labels (${labels.length})</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
      padding: 24px;
      background: #f8f6f1;
      color: #1a1a1a;
    }
    .topbar {
      display: flex; align-items: center; justify-content: space-between;
      max-width: 1100px; margin: 0 auto 20px;
    }
    .topbar h1 { font-size: 18px; margin: 0; color: #5D2E46; font-weight: 700; }
    .topbar button {
      padding: 10px 20px; border-radius: 999px; border: 0;
      background: #D4AF37; color: #2b1422; font-size: 12px;
      font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
      cursor: pointer;
    }
    .grid {
      max-width: 1100px; margin: 0 auto;
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;
    }
    .label {
      background: #fff; border: 1px solid #ecdfd0; border-radius: 12px;
      padding: 14px; text-align: center;
      page-break-inside: avoid;
    }
    .label .qr { width: 100%; aspect-ratio: 1; padding: 8px; }
    .label .qr svg { width: 100%; height: 100%; }
    .label .title {
      font-size: 11px; font-weight: 600; color: #5D2E46;
      margin: 8px 0 2px; line-height: 1.3;
      overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
      -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    .label .variant { font-size: 10px; color: #999; margin: 0 0 6px; }
    .label .code {
      font-family: 'Courier New', monospace;
      font-size: 10.5px; letter-spacing: 1px; color: #5D2E46;
      background: #faf8f3; padding: 3px 6px; border-radius: 4px;
      display: inline-block;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .topbar { display: none; }
      .grid { gap: 8px; }
      .label { border-color: #ddd; }
    }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>${labels.length} authenticity labels</h1>
    <button onclick="window.print()">Print</button>
  </div>
  <div class="grid">
    ${labels
      .map(
        (l) => `
      <div class="label">
        <div class="qr">${l.svg}</div>
        <p class="title">${escapeHtml(l.productTitle)}</p>
        <p class="variant">${escapeHtml(l.variantTitle)}</p>
        <span class="code">${escapeHtml(l.qc.code)}</span>
      </div>
    `
      )
      .join("")}
  </div>
</body>
</html>`

  res.setHeader("Content-Type", "text/html; charset=utf-8")
  res.send(html)
}

function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
