import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { computeAnalytics, type AnalyticsResult } from "../../../../lib/analytics"
import {
  computeCustomerSegments,
  tallySegments,
} from "../../../../lib/segmentation"
import {
  computeProductVelocity,
  type ProductVelocityResult,
} from "../../../../lib/product-velocity"

/**
 * GET /admin/analytics/view?days=30
 * Print-friendly HTML KPI dashboard. Renders KPI cards, an inline-SVG
 * revenue line chart, top-products table, fulfillment + payment breakdown.
 * Designed to be opened in a browser while logged into the Medusa admin.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const days = Number(req.query.days) || 30
  let data: AnalyticsResult
  let segments = { new: 0, repeat: 0, regular: 0 }
  let velocity: ProductVelocityResult | null = null
  try {
    data = await computeAnalytics(req.scope as any, { days })
    const rows = await computeCustomerSegments(req.scope as any)
    segments = tallySegments(rows)
    velocity = await computeProductVelocity(req.scope as any, {
      days,
      limit: 5,
    })
  } catch (e: any) {
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    return res.send(
      `<!doctype html><meta charset="utf-8"><title>Analytics</title><body style="font-family:system-ui;padding:40px"><h1 style="color:#dc2626">Analytics failed</h1><pre>${escape(e?.message || "error")}</pre></body>`
    )
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8")
  res.send(renderDashboard(data, days, segments, velocity))
}

function escape(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function fmt(n: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(n)
}

function pct(curr: number, prev: number): { value: number; label: string } {
  if (!prev) return { value: 0, label: curr ? "new" : "—" }
  const pctVal = ((curr - prev) / prev) * 100
  const sign = pctVal >= 0 ? "+" : ""
  return { value: pctVal, label: `${sign}${pctVal.toFixed(1)}%` }
}

function renderVelocity(
  v: ProductVelocityResult | null,
  currency: string
): string {
  if (!v) return ""
  const cell = (e: ProductVelocityResult["fast"][number]) => `
    <tr>
      <td style="color:#5D2E46;font-weight:600;">${escape(e.title)}</td>
      <td style="text-align:right">${e.units_sold}</td>
      <td style="text-align:right;color:#5D2E46;font-weight:600;">${fmt(e.revenue, currency)}</td>
    </tr>`
  const empty = (msg: string) =>
    `<p style="color:#999;font-size:13px;padding:8px 0;">${msg}</p>`
  return `
    <div class="grid2">
      <div class="card">
        <h2>Fast movers</h2>
        ${
          v.fast.length === 0
            ? empty("No sales in this period yet.")
            : `<table>
                <thead><tr><th>Product</th><th style="text-align:right">Units</th><th style="text-align:right">Revenue</th></tr></thead>
                <tbody>${v.fast.map(cell).join("")}</tbody>
              </table>`
        }
      </div>
      <div class="card">
        <h2>Slow movers</h2>
        ${
          v.slow.length === 0
            ? empty("No products to report.")
            : `<table>
                <thead><tr><th>Product</th><th style="text-align:right">Units</th><th style="text-align:right">Revenue</th></tr></thead>
                <tbody>${v.slow.map(cell).join("")}</tbody>
              </table>`
        }
        <p style="font-size:11px;color:#999;margin-top:10px;">${v.products_with_sales}/${v.total_products} published products sold in the last ${v.range.days} days.</p>
      </div>
    </div>
  `
}

function renderSegmentBars(s: {
  new: number
  repeat: number
  regular: number
}): string {
  const total = s.new + s.repeat + s.regular || 1
  const row = (
    label: string,
    sub: string,
    count: number,
    color: string
  ): string => {
    const pctVal = Math.round((count / total) * 100)
    return `
      <div class="bar">
        <span class="label">${label}<br/><span style="font-size:10.5px;color:#999;text-transform:none;letter-spacing:0">${sub}</span></span>
        <span class="track"><span class="fill" style="width:${pctVal}%;background:${color}"></span></span>
        <span class="v">${count} · ${pctVal}%</span>
      </div>`
  }
  return `<div class="bars">
    ${row("New", "0–1 orders", s.new, "#5D2E46")}
    ${row("Repeat", "2–3 orders", s.repeat, "#D4AF37")}
    ${row("Regular", "4+ orders", s.regular, "#15803d")}
  </div>`
}

function renderChart(
  series: AnalyticsResult["daily_revenue"],
  width = 760,
  height = 200
): string {
  if (!series.length) return ""
  const max = Math.max(...series.map((d) => d.revenue), 1)
  const stepX = series.length > 1 ? width / (series.length - 1) : 0
  const points = series
    .map((d, i) => {
      const x = i * stepX
      const y = height - (d.revenue / max) * (height - 20) - 10
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
  const areaPoints = `0,${height} ${points} ${(width).toFixed(1)},${height}`
  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width:100%;height:200px;">
      <defs>
        <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#D4AF37" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#D4AF37" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="${areaPoints}" fill="url(#grad)" />
      <polyline points="${points}" fill="none" stroke="#5D2E46" stroke-width="2"/>
      ${series
        .map((d, i) => {
          const x = i * stepX
          const y = height - (d.revenue / max) * (height - 20) - 10
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="#5D2E46"/>`
        })
        .join("")}
    </svg>
  `
}

function renderDashboard(
  d: AnalyticsResult,
  days: number,
  segments: { new: number; repeat: number; regular: number },
  velocity: ProductVelocityResult | null
): string {
  const c = d.revenue.currency
  const rev = pct(d.revenue.total, d.revenue.previous)
  const ord = pct(d.orders.count, d.orders.previous)
  const trendCls = (v: number) =>
    v >= 0 ? "color:#15803d" : "color:#dc2626"
  const total =
    d.payment_mix.cod + d.payment_mix.prepaid || 1
  const codPct = Math.round((d.payment_mix.cod / total) * 100)
  const prepaidPct = Math.round((d.payment_mix.prepaid / total) * 100)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Analytics · last ${days} days</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0; padding: 24px; background: #f8f6f1; color: #1a1a1a;
    }
    .wrap { max-width: 1180px; margin: 0 auto; }
    .header {
      display: flex; align-items: baseline; justify-content: space-between;
      margin-bottom: 18px;
    }
    .header h1 {
      font-family: Georgia, serif; font-size: 26px; color: #5D2E46;
      margin: 0; font-weight: 700;
    }
    .header .meta { font-size: 12px; color: #999; }
    .header .range a {
      font-size: 12px; color: #5D2E46; text-decoration: none;
      padding: 6px 12px; border-radius: 999px; border: 1px solid #ecdfd0;
      margin-left: 6px;
    }
    .header .range a.active { background: #5D2E46; color: white; border-color: #5D2E46; }
    .kpis {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
      margin-bottom: 16px;
    }
    .kpi {
      background: #fff; border: 1px solid #ecdfd0; border-radius: 12px;
      padding: 16px; page-break-inside: avoid;
    }
    .kpi .label {
      font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px;
      color: #999; font-weight: 600;
    }
    .kpi .value {
      font-family: Georgia, serif; font-size: 26px; font-weight: 700;
      color: #5D2E46; margin: 6px 0 2px;
    }
    .kpi .trend { font-size: 11.5px; font-weight: 600; }
    .grid2 {
      display: grid; grid-template-columns: 2fr 1fr; gap: 12px;
      margin-bottom: 16px;
    }
    .card {
      background: #fff; border: 1px solid #ecdfd0; border-radius: 12px;
      padding: 18px; page-break-inside: avoid;
    }
    .card h2 {
      font-family: Georgia, serif; font-size: 16px; color: #5D2E46;
      margin: 0 0 12px;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 6px; font-size: 13px; text-align: left; }
    th {
      font-size: 10.5px; text-transform: uppercase; letter-spacing: 1px;
      color: #999; border-bottom: 1px solid #eee; font-weight: 600;
    }
    td { border-bottom: 1px solid #f5f5f5; color: #333; }
    .stat-row {
      display: flex; justify-content: space-between; padding: 8px 0;
      border-bottom: 1px solid #f5f5f5; font-size: 13px;
    }
    .stat-row:last-child { border-bottom: 0; }
    .stat-row .v { font-weight: 600; color: #5D2E46; }
    .bars {
      display: flex; flex-direction: column; gap: 8px; margin-top: 8px;
    }
    .bar {
      display: flex; align-items: center; gap: 10px; font-size: 12.5px;
    }
    .bar .label { width: 90px; color: #666; }
    .bar .track {
      flex: 1; height: 14px; background: #f4ecdf; border-radius: 999px;
      overflow: hidden;
    }
    .bar .fill { height: 100%; border-radius: 999px; }
    .bar .v { width: 60px; text-align: right; font-weight: 600; color: #5D2E46; }
    .footer { text-align: center; color: #999; font-size: 11px; margin-top: 18px; }
    @media print { body { background: #fff; padding: 0; } .header .range { display: none; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div>
        <h1>Store analytics</h1>
        <p class="meta">Last ${days} days · vs preceding ${days} days</p>
      </div>
      <div class="range">
        <a href="?days=7" class="${days === 7 ? "active" : ""}">7d</a>
        <a href="?days=30" class="${days === 30 ? "active" : ""}">30d</a>
        <a href="?days=90" class="${days === 90 ? "active" : ""}">90d</a>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi">
        <p class="label">Revenue</p>
        <p class="value">${fmt(d.revenue.total, c)}</p>
        <p class="trend" style="${trendCls(rev.value)}">${rev.label} vs previous</p>
      </div>
      <div class="kpi">
        <p class="label">Orders</p>
        <p class="value">${d.orders.count}</p>
        <p class="trend" style="${trendCls(ord.value)}">${ord.label} vs previous</p>
      </div>
      <div class="kpi">
        <p class="label">AOV</p>
        <p class="value">${fmt(d.orders.aov, c)}</p>
        <p class="trend" style="color:#999">average order value</p>
      </div>
      <div class="kpi">
        <p class="label">Customers</p>
        <p class="value">${d.customers.total_distinct}</p>
        <p class="trend" style="color:#999">distinct buyers</p>
      </div>
    </div>

    <div class="grid2">
      <div class="card">
        <h2>Daily revenue</h2>
        ${renderChart(d.daily_revenue)}
      </div>
      <div class="card">
        <h2>Quality</h2>
        <div class="stat-row"><span>Return rate</span><span class="v">${d.return_rate_pct}%</span></div>
        <div class="stat-row"><span>RTO rate</span><span class="v">${d.rto_rate_pct}%</span></div>
        <div class="stat-row"><span>Delivered</span><span class="v">${d.fulfillment.delivered}</span></div>
        <div class="stat-row"><span>In transit</span><span class="v">${d.fulfillment.in_transit}</span></div>
        <div class="stat-row"><span>Processing</span><span class="v">${d.fulfillment.processing}</span></div>
        <div class="stat-row"><span>Cancelled / RTO</span><span class="v">${d.fulfillment.canceled}</span></div>
      </div>
    </div>

    <div class="grid2">
      <div class="card">
        <h2>Top products</h2>
        ${
          d.top_products.length === 0
            ? `<p style="color:#999;font-size:13px;padding:8px 0;">No sales in this period yet.</p>`
            : `<table>
                <thead><tr><th>Product</th><th style="text-align:right">Units</th><th style="text-align:right">Revenue</th></tr></thead>
                <tbody>
                  ${d.top_products
                    .map(
                      (p) => `
                    <tr>
                      <td style="color:#5D2E46;font-weight:600;">${escape(p.title)}</td>
                      <td style="text-align:right">${p.units_sold}</td>
                      <td style="text-align:right;color:#5D2E46;font-weight:600;">${fmt(p.revenue, c)}</td>
                    </tr>`
                    )
                    .join("")}
                </tbody>
              </table>`
        }
      </div>
      <div class="card">
        <h2>Payment mix</h2>
        <div class="bars">
          <div class="bar">
            <span class="label">Prepaid</span>
            <span class="track"><span class="fill" style="width:${prepaidPct}%;background:#15803d"></span></span>
            <span class="v">${d.payment_mix.prepaid}</span>
          </div>
          <div class="bar">
            <span class="label">COD</span>
            <span class="track"><span class="fill" style="width:${codPct}%;background:#D4AF37"></span></span>
            <span class="v">${d.payment_mix.cod}</span>
          </div>
          <div class="bar">
            <span class="label">↳ w/ upfront</span>
            <span class="track"><span class="fill" style="width:${d.payment_mix.cod ? Math.round((d.payment_mix.cod_upfront / d.payment_mix.cod) * 100) : 0}%;background:#a0782a"></span></span>
            <span class="v">${d.payment_mix.cod_upfront}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h2>Customer segments</h2>
      ${renderSegmentBars(segments)}
    </div>

    ${renderVelocity(velocity, c)}

    <p class="footer">Snapshot generated ${new Date().toLocaleString("en-IN")} · ${days}-day window</p>
  </div>
</body>
</html>`
}
