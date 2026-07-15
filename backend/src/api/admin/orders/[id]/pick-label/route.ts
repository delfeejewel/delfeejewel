import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import QRCode from "qrcode"

import { QR_CODE_MODULE } from "../../../../../modules/qr_code"

const STOREFRONT = process.env.STOREFRONT_URL || "http://localhost:8000"

/**
 * GET /admin/orders/:id/pick-label
 *
 * Warehouse pick-pack sheet for a single order. Consolidates:
 *   - order number + invoice number
 *   - AWB (from Shiprocket via order metadata)
 *   - sender address (SELLER_ADDRESS env)
 *   - buyer shipping address
 *   - line items (qty × title) for picking
 *   - per-item authenticity QR codes if the items have ones assigned
 *
 * Designed for A4 print (default) or 4×6 thermal labels via ?size=thermal.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const orderId = req.params.id
  const size = (req.query.size as string) === "thermal" ? "thermal" : "a4"
  const country = (req.query.country as string) || "in"
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const qrModule: any = req.scope.resolve(QR_CODE_MODULE)

  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: [
      "id",
      "display_id",
      "email",
      "currency_code",
      "metadata",
      "shipping_address.*",
      "billing_address.*",
      "items.id",
      "items.title",
      "items.product_id",
      "items.variant_id",
      "items.quantity",
      "items.thumbnail",
      "items.variant_title",
      "fulfillments.id",
      "fulfillments.labels.tracking_number",
      "fulfillments.labels.tracking_url",
    ],
  })
  const order = (orders as any[])?.[0]
  if (!order) {
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    return res.send(
      `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:40px;color:#999"><h1>Order not found</h1></body>`
    )
  }

  const meta = (order.metadata || {}) as any
  const awb: string | null =
    meta.awb ||
    ((order.fulfillments as any[]) || [])
      .flatMap((f) => f.labels || [])
      .map((l: any) => l.tracking_number)
      .find(Boolean) ||
    null
  const trackingUrl: string | null =
    ((order.fulfillments as any[]) || [])
      .flatMap((f) => f.labels || [])
      .map((l: any) => l.tracking_url)
      .find(Boolean) ||
    (awb ? `https://www.shiprocket.in/tracking/${awb}` : null)
  const invoiceNumber: string =
    meta.invoice_number || `INV-${order.display_id || ""}`

  // Fetch one active QR code per variant in the order so the picker can stick
  // an authenticity label per unit picked.
  const variantIds = ((order.items as any[]) || [])
    .map((it: any) => it.variant_id)
    .filter(Boolean)
  const qrByVariant = new Map<string, any>()
  if (variantIds.length) {
    const qrCodes = await qrModule.listQrCodes({
      variant_id: variantIds,
      status: "active",
    })
    for (const qc of qrCodes || []) {
      if (!qrByVariant.has(qc.variant_id)) qrByVariant.set(qc.variant_id, qc)
    }
  }

  const items = await Promise.all(
    ((order.items as any[]) || []).map(async (it: any) => {
      const qc = qrByVariant.get(it.variant_id)
      let qrSvg: string | null = null
      if (qc) {
        const verifyUrl = `${STOREFRONT}/${country}/verify/${qc.code}`
        qrSvg = await QRCode.toString(verifyUrl, {
          type: "svg",
          margin: 0,
          errorCorrectionLevel: "M",
          color: { dark: "#1a1a1a", light: "#ffffff" },
        })
      }
      return {
        id: it.id,
        title: it.title,
        variantTitle: it.variant_title || "",
        quantity: it.quantity,
        qrSvg,
        qrCode: qc?.code || null,
      }
    })
  )

  const sender = {
    name: process.env.SELLER_NAME || process.env.BRAND_NAME || "Delfee",
    address: process.env.SELLER_ADDRESS || "",
    gstin: process.env.SELLER_GSTIN || "",
  }

  const buyer = (order.shipping_address as any) || {}

  res.setHeader("Content-Type", "text/html; charset=utf-8")
  res.send(renderLabel({ order, awb, trackingUrl, invoiceNumber, sender, buyer, items, size }))
}

function escape(s: any): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function formatAddress(a: any): string {
  if (!a) return ""
  const lines = [
    [a.first_name, a.last_name].filter(Boolean).join(" "),
    a.company,
    a.address_1,
    a.address_2,
    [a.city, a.province, a.postal_code].filter(Boolean).join(", "),
    a.country_code ? String(a.country_code).toUpperCase() : "",
    a.phone ? `Ph: ${a.phone}` : "",
  ].filter(Boolean)
  return lines.map(escape).join("<br/>")
}

function renderLabel(p: {
  order: any
  awb: string | null
  trackingUrl: string | null
  invoiceNumber: string
  sender: { name: string; address: string; gstin: string }
  buyer: any
  items: Array<{
    id: string
    title: string
    variantTitle: string
    quantity: number
    qrSvg: string | null
    qrCode: string | null
  }>
  size: "a4" | "thermal"
}): string {
  const pageCSS =
    p.size === "thermal"
      ? `@page { size: 4in 6in; margin: 4mm; } body { padding: 6mm; }`
      : `@page { size: A4; margin: 10mm; } body { padding: 14px; }`

  const itemsHTML = p.items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;font-size:12.5px;color:#1a1a1a;">
          <strong>${it.quantity} ×</strong> ${escape(it.title)}
          ${it.variantTitle ? `<br/><span style="color:#666;font-size:11px;">${escape(it.variantTitle)}</span>` : ""}
        </td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;width:84px;text-align:center;">
          ${
            it.qrSvg
              ? `<div style="width:80px;height:80px;margin:0 auto;">${it.qrSvg}</div>
                 <p style="font-family:'Courier New',monospace;font-size:9.5px;color:#5D2E46;margin:3px 0 0;letter-spacing:0.5px;">${escape(it.qrCode || "")}</p>`
              : `<span style="font-size:10px;color:#bbb;">no QR</span>`
          }
        </td>
      </tr>`
    )
    .join("")

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Pick-pack · #${escape(p.order.display_id)}</title>
  <style>
    ${pageCSS}
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0; color: #1a1a1a; background: #fff;
    }
    .topbar {
      display: flex; justify-content: space-between; align-items: center;
      margin: 0 0 14px; padding-bottom: 10px; border-bottom: 2px solid #5D2E46;
    }
    .topbar h1 {
      margin: 0; font-size: 16px; color: #5D2E46; font-weight: 700;
      letter-spacing: 0.5px;
    }
    .topbar .meta { text-align: right; font-size: 11px; color: #666; line-height: 1.5; }
    .topbar .meta strong { color: #1a1a1a; }
    .order-line {
      display: flex; justify-content: space-between; gap: 12px;
      font-size: 12.5px; margin: 10px 0 14px;
    }
    .order-line .pill {
      padding: 4px 12px; border-radius: 4px; background: #faf8f3;
      border: 1px solid #ecdfd0; font-family: 'Courier New', monospace;
      font-size: 11.5px; color: #5D2E46; letter-spacing: 0.5px;
    }
    .addr-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
      margin-bottom: 14px;
    }
    .addr {
      border: 1px solid #ecdfd0; border-radius: 8px; padding: 10px 12px;
      font-size: 11px; line-height: 1.6;
    }
    .addr .label {
      font-size: 9.5px; text-transform: uppercase; letter-spacing: 1.2px;
      color: #999; font-weight: 700; margin-bottom: 4px;
    }
    .addr .body { color: #1a1a1a; }
    .awb-block {
      border: 2px solid #1a1a1a; border-radius: 8px; padding: 10px 14px;
      margin-bottom: 14px; text-align: center;
    }
    .awb-block .label {
      font-size: 9.5px; text-transform: uppercase; letter-spacing: 1.5px;
      color: #666; margin: 0 0 4px;
    }
    .awb-block .awb {
      font-family: 'Courier New', monospace; font-size: 22px; font-weight: 700;
      color: #1a1a1a; letter-spacing: 2px;
    }
    .awb-block .courier { font-size: 10.5px; color: #666; margin-top: 4px; }
    table.items { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    table.items th {
      text-align: left; font-size: 9.5px; text-transform: uppercase;
      letter-spacing: 1.5px; color: #999; padding: 6px; border-bottom: 1px solid #5D2E46;
    }
    .checkmark {
      width: 14px; height: 14px; border: 1.5px solid #999; border-radius: 3px;
      display: inline-block; vertical-align: middle; margin-right: 8px;
    }
    .footer-note {
      margin-top: 14px; padding-top: 10px; border-top: 1px dashed #ccc;
      font-size: 10.5px; color: #888; line-height: 1.5;
    }
    .printbar {
      max-width: 800px; margin: 0 auto 16px; display: flex; gap: 10px;
      justify-content: flex-end;
    }
    .printbar button {
      padding: 8px 16px; border: 0; border-radius: 999px;
      background: #5D2E46; color: #fff; font-size: 11px; font-weight: 700;
      letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer;
    }
    @media print { .printbar { display: none; } }
  </style>
</head>
<body>
  <div class="printbar">
    <button onclick="window.print()">Print</button>
  </div>

  <div class="topbar">
    <h1>${escape(p.sender.name)}</h1>
    <div class="meta">
      <strong>Order #${escape(p.order.display_id)}</strong><br/>
      Invoice: ${escape(p.invoiceNumber)}<br/>
      ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
    </div>
  </div>

  ${
    p.awb
      ? `<div class="awb-block">
          <p class="label">Air Waybill (AWB)</p>
          <p class="awb">${escape(p.awb)}</p>
          ${p.trackingUrl ? `<p class="courier">Track: ${escape(p.trackingUrl)}</p>` : ""}
        </div>`
      : `<div class="awb-block" style="border-color:#e0a000;background:#fff8e1;">
          <p class="label" style="color:#8a6500;">AWB pending</p>
          <p class="awb" style="font-size:14px;color:#8a6500;">Generate via Shiprocket before dispatch</p>
        </div>`
  }

  <div class="addr-grid">
    <div class="addr">
      <p class="label">From (sender)</p>
      <div class="body">
        <strong>${escape(p.sender.name)}</strong><br/>
        ${escape(p.sender.address).replace(/\n/g, "<br/>")}
        ${p.sender.gstin ? `<br/>GSTIN: ${escape(p.sender.gstin)}` : ""}
      </div>
    </div>
    <div class="addr" style="border-color:#1a1a1a;">
      <p class="label">Ship to</p>
      <div class="body">${formatAddress(p.buyer)}</div>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th>Items to pack</th>
        <th style="text-align:center;width:84px;">Authenticity QR</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>

  <div class="footer-note">
    <span class="checkmark"></span> Verified items match order
    &nbsp;&nbsp;
    <span class="checkmark"></span> Authenticity QR(s) affixed
    &nbsp;&nbsp;
    <span class="checkmark"></span> Invoice enclosed
  </div>
</body>
</html>`
}
