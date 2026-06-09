import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChartBar } from "@medusajs/icons"
import { Container, Heading, Text, Button } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"

// ─── Types mirror the backend JSON (src/lib/*.ts) ────────────────────────────

type AnalyticsResult = {
  range: { from: string; to: string; days: number }
  revenue: { total: number; previous: number; currency: string }
  orders: { count: number; previous: number; aov: number }
  customers: { total_distinct: number; new_in_window: number }
  fulfillment: {
    delivered: number
    in_transit: number
    processing: number
    canceled: number
  }
  payment_mix: { cod: number; prepaid: number; cod_upfront: number }
  return_rate_pct: number
  rto_rate_pct: number
  top_products: Array<{
    product_id: string
    title: string
    units_sold: number
    revenue: number
  }>
  daily_revenue: Array<{ date: string; revenue: number; orders: number }>
}

type VelocityEntry = {
  product_id: string
  title: string
  thumbnail: string | null
  units_sold: number
  revenue: number
}

type ProductVelocityResult = {
  range: { days: number; from: string; to: string }
  fast: VelocityEntry[]
  slow: VelocityEntry[]
  total_products: number
  products_with_sales: number
}

type SegmentTotals = { new: number; repeat: number; regular: number }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: (currency || "INR").toUpperCase(),
    maximumFractionDigits: 0,
  }).format(n || 0)

const pct = (curr: number, prev: number): { value: number; label: string } => {
  if (!prev) return { value: 0, label: curr ? "new" : "—" }
  const v = ((curr - prev) / prev) * 100
  return { value: v, label: `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` }
}

const ACCENT = "#5D2E46"
const GOLD = "#D4AF37"
const GREEN = "#15803d"
const RED = "#dc2626"

const DAY_OPTIONS = [7, 30, 90] as const

// ─── Small presentational pieces ──────────────────────────────────────────────

const Card = ({
  title,
  children,
  style,
}: {
  title?: string
  children: React.ReactNode
  style?: React.CSSProperties
}) => (
  <div
    style={{
      background: "var(--bg-base)",
      border: "1px solid var(--border-base)",
      borderRadius: 12,
      padding: 18,
      ...style,
    }}
  >
    {title && (
      <Text
        size="small"
        weight="plus"
        style={{ color: "var(--fg-base)", marginBottom: 12, display: "block" }}
      >
        {title}
      </Text>
    )}
    {children}
  </div>
)

const Kpi = ({
  label,
  value,
  trend,
}: {
  label: string
  value: string
  trend?: { label: string; positive?: boolean; muted?: boolean }
}) => (
  <Card style={{ padding: 16 }}>
    <Text
      size="xsmall"
      style={{
        textTransform: "uppercase",
        letterSpacing: 1.4,
        color: "var(--fg-muted)",
        fontWeight: 600,
      }}
    >
      {label}
    </Text>
    <div
      style={{
        fontFamily: "Georgia, serif",
        fontSize: 26,
        fontWeight: 700,
        color: ACCENT,
        margin: "6px 0 2px",
      }}
    >
      {value}
    </div>
    {trend && (
      <Text
        size="xsmall"
        style={{
          fontWeight: 600,
          color: trend.muted
            ? "var(--fg-muted)"
            : trend.positive
              ? GREEN
              : RED,
        }}
      >
        {trend.label}
      </Text>
    )}
  </Card>
)

const RevenueChart = ({
  series,
  currency,
}: {
  series: AnalyticsResult["daily_revenue"]
  currency: string
}) => {
  const [hover, setHover] = useState<number | null>(null)
  const width = 760
  const height = 220
  const padTop = 14
  const padBottom = 12

  const { points, areaPoints, max } = useMemo(() => {
    if (!series.length)
      return { points: "", areaPoints: "", max: 0 }
    const mx = Math.max(...series.map((d) => d.revenue), 1)
    const stepX = series.length > 1 ? width / (series.length - 1) : 0
    const coords = series.map((d, i) => {
      const x = i * stepX
      const y =
        height - (d.revenue / mx) * (height - padTop - padBottom) - padBottom
      return { x, y }
    })
    const pts = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ")
    return {
      points: pts,
      areaPoints: `0,${height} ${pts} ${width.toFixed(1)},${height}`,
      max: mx,
    }
  }, [series])

  if (!series.length)
    return (
      <Text size="small" style={{ color: "var(--fg-muted)" }}>
        No revenue data in this period.
      </Text>
    )

  const stepX = series.length > 1 ? width / (series.length - 1) : 0
  const hovered = hover != null ? series[hover] : null

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: 220, display: "block" }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="rev-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
            <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#rev-grad)" />
        <polyline
          points={points}
          fill="none"
          stroke={ACCENT}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        {series.map((d, i) => {
          const x = i * stepX
          const y =
            height -
            (d.revenue / max) * (height - padTop - padBottom) -
            padBottom
          return (
            <g key={d.date}>
              {hover === i && (
                <line
                  x1={x}
                  x2={x}
                  y1={padTop}
                  y2={height}
                  stroke={ACCENT}
                  strokeOpacity={0.25}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={hover === i ? 4 : 2.5}
                fill={ACCENT}
              />
              {/* wide invisible hit target */}
              <rect
                x={x - stepX / 2}
                y={0}
                width={stepX || width}
                height={height}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          )
        })}
      </svg>
      {hovered && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-base)",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 12,
            pointerEvents: "none",
          }}
        >
          <div style={{ color: "var(--fg-muted)" }}>
            {new Date(hovered.date).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}
          </div>
          <div style={{ fontWeight: 700, color: ACCENT }}>
            {fmt(hovered.revenue, currency)}
          </div>
          <div style={{ color: "var(--fg-muted)" }}>
            {hovered.orders} order{hovered.orders === 1 ? "" : "s"}
          </div>
        </div>
      )}
    </div>
  )
}

const Bar = ({
  label,
  sub,
  value,
  total,
  color,
}: {
  label: string
  sub?: string
  value: number
  total: number
  color: string
}) => {
  const pctVal = total ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
      <div style={{ width: 96, color: "var(--fg-subtle)" }}>
        {label}
        {sub && (
          <div style={{ fontSize: 10.5, color: "var(--fg-muted)" }}>{sub}</div>
        )}
      </div>
      <div
        style={{
          flex: 1,
          height: 14,
          background: "var(--bg-subtle)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pctVal}%`,
            height: "100%",
            background: color,
            borderRadius: 999,
            transition: "width .3s ease",
          }}
        />
      </div>
      <div
        style={{
          width: 70,
          textAlign: "right",
          fontWeight: 600,
          color: ACCENT,
        }}
      >
        {value} · {pctVal}%
      </div>
    </div>
  )
}

const ProductTable = ({
  rows,
  currency,
  empty,
}: {
  rows: Array<{ title: string; units_sold: number; revenue: number }>
  currency: string
  empty: string
}) => {
  if (!rows.length)
    return (
      <Text size="small" style={{ color: "var(--fg-muted)" }}>
        {empty}
      </Text>
    )
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {["Product", "Units", "Revenue"].map((h, i) => (
            <th
              key={h}
              style={{
                padding: "8px 6px",
                fontSize: 10.5,
                textTransform: "uppercase",
                letterSpacing: 1,
                color: "var(--fg-muted)",
                fontWeight: 600,
                borderBottom: "1px solid var(--border-base)",
                textAlign: i === 0 ? "left" : "right",
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((p, i) => (
          <tr key={i}>
            <td
              style={{
                padding: "8px 6px",
                fontSize: 13,
                fontWeight: 600,
                color: ACCENT,
                borderBottom: "1px solid var(--border-base)",
              }}
            >
              {p.title}
            </td>
            <td
              style={{
                padding: "8px 6px",
                fontSize: 13,
                textAlign: "right",
                color: "var(--fg-base)",
                borderBottom: "1px solid var(--border-base)",
              }}
            >
              {p.units_sold}
            </td>
            <td
              style={{
                padding: "8px 6px",
                fontSize: 13,
                textAlign: "right",
                fontWeight: 600,
                color: ACCENT,
                borderBottom: "1px solid var(--border-base)",
              }}
            >
              {fmt(p.revenue, currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const StatRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      padding: "8px 0",
      borderBottom: "1px solid var(--border-base)",
      fontSize: 13,
    }}
  >
    <span style={{ color: "var(--fg-subtle)" }}>{label}</span>
    <span style={{ fontWeight: 600, color: ACCENT }}>{value}</span>
  </div>
)

// ─── Page ──────────────────────────────────────────────────────────────────

const AnalyticsPage = () => {
  const [days, setDays] = useState<number>(30)
  const [data, setData] = useState<AnalyticsResult | null>(null)
  const [velocity, setVelocity] = useState<ProductVelocityResult | null>(null)
  const [segments, setSegments] = useState<SegmentTotals | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = (d: number) => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`/admin/analytics?days=${d}`, { credentials: "include" }),
      fetch(`/admin/products/velocity?days=${d}&limit=5`, {
        credentials: "include",
      }),
      fetch(`/admin/customers/segments?limit=1`, { credentials: "include" }),
    ])
      .then(async ([a, v, s]) => {
        const ab = await a.json().catch(() => ({}))
        if (!a.ok) throw new Error(ab?.message || `Analytics HTTP ${a.status}`)
        setData(ab)
        const vb = await v.json().catch(() => null)
        setVelocity(v.ok ? vb : null)
        const sb = await s.json().catch(() => null)
        setSegments(s.ok && sb?.totals ? sb.totals : null)
      })
      .catch((e) => setError(e?.message || "Failed to load analytics"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(days)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  const currency = data?.revenue.currency || "INR"
  const rev = data ? pct(data.revenue.total, data.revenue.previous) : null
  const ord = data ? pct(data.orders.count, data.orders.previous) : null
  const paymentTotal = data
    ? data.payment_mix.cod + data.payment_mix.prepaid
    : 0
  const segTotal = segments
    ? segments.new + segments.repeat + segments.regular
    : 0

  return (
    <Container>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <Heading level="h1">Store analytics</Heading>
            <Text
              size="small"
              style={{ color: "var(--fg-subtle)", marginTop: 4 }}
            >
              Last {days} days · compared to the preceding {days} days
            </Text>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {DAY_OPTIONS.map((d) => (
              <Button
                key={d}
                size="small"
                variant={days === d ? "primary" : "secondary"}
                onClick={() => setDays(d)}
                disabled={loading}
              >
                {d}d
              </Button>
            ))}
            <Button
              size="small"
              variant="transparent"
              onClick={() => {
                window.open(`/admin/analytics/view?days=${days}`, "_blank")
              }}
            >
              Print view
            </Button>
          </div>
        </div>

        {loading && (
          <Text size="small" style={{ color: "var(--fg-muted)" }}>
            Loading…
          </Text>
        )}
        {error && (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              border: `1px solid ${RED}`,
              color: RED,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {data && !loading && !error && (
          <>
            {/* KPI cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
              }}
            >
              <Kpi
                label="Revenue"
                value={fmt(data.revenue.total, currency)}
                trend={
                  rev
                    ? {
                        label: `${rev.label} vs previous`,
                        positive: rev.value >= 0,
                        muted: rev.label === "new" || rev.label === "—",
                      }
                    : undefined
                }
              />
              <Kpi
                label="Orders"
                value={String(data.orders.count)}
                trend={
                  ord
                    ? {
                        label: `${ord.label} vs previous`,
                        positive: ord.value >= 0,
                        muted: ord.label === "new" || ord.label === "—",
                      }
                    : undefined
                }
              />
              <Kpi
                label="AOV"
                value={fmt(data.orders.aov, currency)}
                trend={{ label: "average order value", muted: true }}
              />
              <Kpi
                label="Customers"
                value={String(data.customers.total_distinct)}
                trend={{ label: "distinct buyers", muted: true }}
              />
            </div>

            {/* Revenue chart + quality */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gap: 12,
              }}
            >
              <Card title="Daily revenue">
                <RevenueChart
                  series={data.daily_revenue}
                  currency={currency}
                />
              </Card>
              <Card title="Quality">
                <StatRow label="Return rate" value={`${data.return_rate_pct}%`} />
                <StatRow label="RTO rate" value={`${data.rto_rate_pct}%`} />
                <StatRow label="Delivered" value={data.fulfillment.delivered} />
                <StatRow label="In transit" value={data.fulfillment.in_transit} />
                <StatRow label="Processing" value={data.fulfillment.processing} />
                <StatRow
                  label="Cancelled / RTO"
                  value={data.fulfillment.canceled}
                />
              </Card>
            </div>

            {/* Top products + payment mix */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gap: 12,
              }}
            >
              <Card title="Top products">
                <ProductTable
                  rows={data.top_products}
                  currency={currency}
                  empty="No sales in this period yet."
                />
              </Card>
              <Card title="Payment mix">
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <Bar
                    label="Prepaid"
                    value={data.payment_mix.prepaid}
                    total={paymentTotal}
                    color={GREEN}
                  />
                  <Bar
                    label="COD"
                    value={data.payment_mix.cod}
                    total={paymentTotal}
                    color={GOLD}
                  />
                  <Bar
                    label="↳ w/ upfront"
                    value={data.payment_mix.cod_upfront}
                    total={data.payment_mix.cod || 1}
                    color="#a0782a"
                  />
                </div>
              </Card>
            </div>

            {/* Customer segments */}
            <Card title="Customer segments">
              {segments && segTotal > 0 ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <Bar
                    label="New"
                    sub="0–1 orders"
                    value={segments.new}
                    total={segTotal}
                    color={ACCENT}
                  />
                  <Bar
                    label="Repeat"
                    sub="2–3 orders"
                    value={segments.repeat}
                    total={segTotal}
                    color={GOLD}
                  />
                  <Bar
                    label="Regular"
                    sub="4+ orders"
                    value={segments.regular}
                    total={segTotal}
                    color={GREEN}
                  />
                </div>
              ) : (
                <Text size="small" style={{ color: "var(--fg-muted)" }}>
                  No customer history yet.
                </Text>
              )}
            </Card>

            {/* Product velocity */}
            {velocity && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <Card title="Fast movers">
                  <ProductTable
                    rows={velocity.fast}
                    currency={currency}
                    empty="No sales in this period yet."
                  />
                </Card>
                <Card title="Slow movers">
                  <ProductTable
                    rows={velocity.slow}
                    currency={currency}
                    empty="No products to report."
                  />
                  <Text
                    size="xsmall"
                    style={{ color: "var(--fg-muted)", marginTop: 10, display: "block" }}
                  >
                    {velocity.products_with_sales}/{velocity.total_products}{" "}
                    published products sold in the last {velocity.range.days}{" "}
                    days.
                  </Text>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Analytics",
  icon: ChartBar,
})

export default AnalyticsPage
