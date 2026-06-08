"use client"

import { Download } from "lucide-react"
import { HttpTypes } from "@medusajs/types"
import { convertToLocale } from "@lib/util/money"
import { BRAND } from "@lib/constants.brand"

/**
 * Generates a clean, print-friendly invoice in a new window and triggers the
 * browser's print dialog (which lets the user "Save as PDF"). Self-contained —
 * no PDF library or backend route required.
 */
const InvoiceButton = ({
  order,
  className = "",
}: {
  order: HttpTypes.StoreOrder
  className?: string
}) => {
  const fmt = (amount: number) =>
    convertToLocale({ amount: amount || 0, currency_code: order.currency_code })

  const handleDownload = () => {
    const a = order.shipping_address
    const addr = a
      ? [
          `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim(),
          a.address_1,
          a.address_2,
          `${a.city ?? ""}${a.province ? ", " + a.province : ""} ${a.postal_code ?? ""}`.trim(),
          (a.country_code || "").toUpperCase(),
          a.phone,
        ]
          .filter(Boolean)
          .join("<br/>")
      : ""

    const date = order.created_at
      ? new Date(order.created_at).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : ""

    const origin =
      typeof window !== "undefined" ? window.location.origin : ""

    // Payment + shipping method labels
    const provider =
      order.payment_collections?.[0]?.payments?.[0]?.provider_id || ""
    const providerLabels: Record<string, string> = {
      pp_razorpay_razorpay: "Razorpay (UPI / Cards / Wallets)",
      razorpay: "Razorpay (UPI / Cards / Wallets)",
      pp_system_default: "Manual",
      "pp_cod_cod": "Cash on Delivery",
      cod: "Cash on Delivery",
    }
    const paymentLabel = provider
      ? providerLabels[provider] || provider
      : "—"
    const shipMethod = (order as any).shipping_methods?.[0]
    const shipLabel = shipMethod
      ? `${shipMethod.name} (${fmt(shipMethod.total ?? shipMethod.amount ?? 0)})`
      : "—"

    // Billing block (only shown separately if it differs from shipping)
    const b = order.billing_address
    const sameBilling =
      !b ||
      (b.address_1 === a?.address_1 &&
        b.postal_code === a?.postal_code &&
        b.first_name === a?.first_name)
    const billAddr =
      b && !sameBilling
        ? [
            `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim(),
            b.address_1,
            b.address_2,
            `${b.city ?? ""}${b.province ? ", " + b.province : ""} ${b.postal_code ?? ""}`.trim(),
            (b.country_code || "").toUpperCase(),
            b.phone,
          ]
            .filter(Boolean)
            .join("<br/>")
        : ""

    const rows = (order.items || [])
      .map(
        (it: any, i: number) => `
        <tr style="${i % 2 ? "background:#faf8fb;" : ""}">
          <td class="cell">
            <div class="item-title">${it.title}</div>
            ${it.variant_title ? `<div class="item-variant">${it.variant_title}</div>` : ""}
          </td>
          <td class="cell" style="text-align:center;">${it.quantity}</td>
          <td class="cell num" style="text-align:right;">${fmt(it.unit_price)}</td>
          <td class="cell num" style="text-align:right;font-weight:600;">${fmt((it.unit_price || 0) * (it.quantity || 0))}</td>
        </tr>`
      )
      .join("")

    const o: any = order
    const html = `<!doctype html><html><head><meta charset="utf-8"/>
      <title>Invoice ${o.display_id ?? ""} — ${BRAND.name}</title>
      <style>
        :root { --plum:#5D2E46; --plum-deep:#42203250; --gold:#b8893f; --ink:#1a1a1a; --muted:#8a8a8a; --line:#ece7ee; }
        * { font-family: 'Helvetica Neue', Arial, sans-serif; box-sizing:border-box; }
        body { margin:0; color:var(--ink); background:#f5f3f5; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .sheet { max-width:760px; margin:32px auto; background:#fff; border-radius:14px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.06); }
        .band { background:linear-gradient(120deg,var(--plum),#7a3d5e); color:#fff; padding:28px 40px; display:flex; justify-content:space-between; align-items:flex-start; }
        .band .logo { height:34px; width:auto; display:block; margin-bottom:8px; }
        .brand { font-size:26px; font-weight:700; letter-spacing:.5px; }
        .band .sub { font-size:11px; text-transform:uppercase; letter-spacing:.18em; opacity:.85; margin-top:4px; }
        .band .meta { text-align:right; font-size:12.5px; line-height:1.7; }
        .band .meta .big { font-size:15px; font-weight:700; }
        .accent { height:4px; background:linear-gradient(90deg,var(--gold),#e6c27a,var(--gold)); }
        .body { padding:32px 40px 40px; }
        h2 { font-size:11px; text-transform:uppercase; letter-spacing:.14em; color:var(--muted); margin:0 0 8px; }
        .addr { font-size:13.5px; line-height:1.65; color:#333; }
        .info { display:flex; flex-wrap:wrap; gap:32px 48px; margin:24px 0 28px; }
        .info > div { font-size:13.5px; color:#333; }
        .info .val { color:#1a1a1a; }
        table { width:100%; border-collapse:collapse; font-size:13.5px; }
        thead th { text-align:left; padding:10px 10px; border-bottom:2px solid var(--plum); font-size:10.5px; text-transform:uppercase; letter-spacing:.08em; color:var(--plum); }
        .cell { padding:11px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
        .item-title { font-weight:600; }
        .item-variant { color:var(--muted); font-size:12px; margin-top:2px; }
        .num { font-variant-numeric:tabular-nums; }
        .totals { margin:22px 0 0 auto; width:300px; font-size:13.5px; }
        .totals .row { display:flex; justify-content:space-between; padding:7px 10px; color:#444; }
        .totals .grand { margin-top:6px; padding:14px 10px; border-top:2px solid var(--line); font-weight:700; font-size:16px; color:#fff; background:var(--plum); border-radius:8px; }
        .foot { margin-top:40px; padding-top:20px; border-top:1px solid var(--line); text-align:center; color:var(--muted); font-size:12px; line-height:1.6; }
        @media print { body { background:#fff; } .sheet { box-shadow:none; margin:0; max-width:none; border-radius:0; } }
      </style></head>
      <body>
        <div class="sheet">
          <div class="band">
            <div>
              <img class="logo" src="${origin}/images/logo-light.png" alt="${BRAND.name}" onerror="this.style.display='none';document.getElementById('brandFallback').style.display='block';"/>
              <div id="brandFallback" class="brand" style="display:none;">${BRAND.name}</div>
              <div class="sub">Tax Invoice / Receipt</div>
            </div>
            <div class="meta">
              <div class="big">Invoice #${o.display_id ?? ""}</div>
              <div>${date}</div>
              <div>${order.email ?? ""}</div>
            </div>
          </div>
          <div class="accent"></div>
          <div class="body">
            <div style="display:flex;flex-wrap:wrap;gap:32px 48px;">
              <div>
                <h2>${billAddr ? "Shipped to" : "Billed &amp; Shipped to"}</h2>
                <div class="addr">${addr}</div>
              </div>
              ${billAddr ? `<div><h2>Billed to</h2><div class="addr">${billAddr}</div></div>` : ""}
            </div>

            <div class="info">
              <div><h2>Payment method</h2><div class="val">${paymentLabel}</div></div>
              <div><h2>Shipping method</h2><div class="val">${shipLabel}</div></div>
            </div>

            <table>
              <thead>
                <tr><th>Item</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Unit</th><th style="text-align:right;">Amount</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>

            <div class="totals">
              <div class="row"><span>Subtotal</span><span class="num">${fmt(o.item_total ?? o.subtotal)}</span></div>
              <div class="row"><span>Shipping</span><span class="num">${fmt(o.shipping_total)}</span></div>
              <div class="row"><span>Taxes</span><span class="num">${fmt(o.tax_total)}</span></div>
              ${o.discount_total ? `<div class="row"><span>Discount</span><span class="num">- ${fmt(o.discount_total)}</span></div>` : ""}
              <div class="row grand"><span>Total</span><span class="num">${fmt(o.total)}</span></div>
            </div>

            <div class="foot">
              <strong style="color:var(--plum);">${BRAND.name}</strong> · ${BRAND.tagline}<br/>
              Questions? enquire@delfee.in<br/>
              Thank you for shopping with ${BRAND.name}. This is a computer-generated
              invoice and does not require a signature.
            </div>
          </div>
        </div>
        <script>window.onload = function(){ window.print(); }</script>
      </body></html>`

    const w = window.open("", "_blank", "width=800,height=900")
    if (!w) return
    w.document.write(html)
    w.document.close()
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className={`inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full border-2 border-[var(--color-plum)] text-[var(--color-plum)] text-[12px] font-bold uppercase tracking-wider hover:bg-[var(--color-plum)] hover:text-white transition-all ${className}`}
      data-testid="download-invoice-button"
    >
      <Download size={15} />
      Download Invoice
    </button>
  )
}

export default InvoiceButton
