import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { RETURN_REQUEST_MODULE } from "../modules/return_request"

export type AnalyticsResult = {
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

function isOnlineProvider(providerId?: string | null): boolean {
  const id = (providerId || "").toLowerCase()
  if (!id) return false
  if (id.includes("cod") || id.includes("manual") || id.includes("system"))
    return false
  return (
    id.includes("razor") ||
    id.includes("stripe") ||
    id.includes("paypal") ||
    id.startsWith("pp_")
  )
}

export async function computeAnalytics(
  container: MedusaContainer,
  opts?: { days?: number }
): Promise<AnalyticsResult> {
  const days = Math.max(1, Math.min(365, opts?.days || 30))
  const now = Date.now()
  const ms = days * 86400_000
  const fromIso = new Date(now - ms).toISOString()
  const prevFromIso = new Date(now - 2 * ms).toISOString()

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const returnModule: any = container.resolve(RETURN_REQUEST_MODULE)

  // Pull every order in the last 2× window so we can compute prev-period delta
  const { data: orders } = await query.graph({
    entity: "order",
    filters: { created_at: { $gte: prevFromIso } as any },
    fields: [
      "id",
      "display_id",
      "total",
      "currency_code",
      "created_at",
      "customer_id",
      "metadata",
      "items.title",
      "items.product_id",
      "items.quantity",
      "items.unit_price",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.captured_at",
    ],
  })
  const allOrders = (orders as any[]) || []
  const fromTs = new Date(fromIso).getTime()
  const inWindow = allOrders.filter(
    (o) => new Date(o.created_at).getTime() >= fromTs
  )
  const prevWindow = allOrders.filter((o) => {
    const t = new Date(o.created_at).getTime()
    return t < fromTs && t >= new Date(prevFromIso).getTime()
  })

  const currency =
    inWindow[0]?.currency_code || allOrders[0]?.currency_code || "inr"

  // Revenue + orders
  const sumTotal = (xs: any[]) =>
    xs.reduce((s, o) => s + (Number(o.total) || 0), 0)
  const revenue = sumTotal(inWindow)
  const revenuePrev = sumTotal(prevWindow)
  const ordersCount = inWindow.length
  const aov = ordersCount ? Math.round(revenue / ordersCount) : 0

  // Customers
  const distinctCustomers = new Set(
    inWindow.map((o) => o.customer_id).filter(Boolean)
  )
  const newCustomers = distinctCustomers.size // approximation — distinct buyers in window

  // Fulfillment buckets by metadata.shiprocket_status (the real-world state)
  const buckets = { delivered: 0, in_transit: 0, processing: 0, canceled: 0 }
  for (const o of inWindow) {
    const status = String(
      (o.metadata as any)?.shiprocket_status || ""
    ).toLowerCase()
    if (status.includes("rto") || status.includes("cancel")) buckets.canceled++
    else if (status.includes("delivered")) buckets.delivered++
    else if (
      status.includes("transit") ||
      status.includes("shipped") ||
      status.includes("out for delivery") ||
      status.includes("picked")
    ) {
      buckets.in_transit++
    } else buckets.processing++
  }

  // Payment mix
  const mix = { cod: 0, prepaid: 0, cod_upfront: 0 }
  for (const o of inWindow) {
    const payments = ((o.payment_collections as any[]) || []).flatMap(
      (pc) => pc?.payments || []
    )
    const hasPrepaid = payments.some(
      (p) => p?.captured_at && isOnlineProvider(p?.provider_id)
    )
    const hasCod = payments.some((p) =>
      String(p?.provider_id || "")
        .toLowerCase()
        .includes("cod")
    )
    const codUpfront = !!(o.metadata as any)?.cod_upfront_amount
    if (hasPrepaid) mix.prepaid++
    else if (hasCod) {
      mix.cod++
      if (codUpfront) mix.cod_upfront++
    }
  }

  // Return rate — orders in window with at least one return request
  const orderIds = inWindow.map((o) => o.id)
  let ordersWithReturn = 0
  if (orderIds.length) {
    const requests = await returnModule.listReturnRequests({
      order_id: orderIds,
    })
    const set = new Set((requests || []).map((r: any) => r.order_id))
    ordersWithReturn = set.size
  }
  const returnRatePct = ordersCount
    ? Math.round((ordersWithReturn / ordersCount) * 1000) / 10
    : 0
  const rtoRatePct = ordersCount
    ? Math.round((buckets.canceled / ordersCount) * 1000) / 10
    : 0

  // Top products — aggregate units + revenue across all order items in window
  const productAgg = new Map<
    string,
    { title: string; units: number; revenue: number }
  >()
  for (const o of inWindow) {
    for (const item of (o.items as any[]) || []) {
      const pid = item.product_id || "unknown"
      const cur = productAgg.get(pid) || {
        title: item.title || "Unknown",
        units: 0,
        revenue: 0,
      }
      cur.units += Number(item.quantity || 0)
      cur.revenue += Number(item.unit_price || 0) * Number(item.quantity || 0)
      if (!cur.title || cur.title === "Unknown") cur.title = item.title || cur.title
      productAgg.set(pid, cur)
    }
  }
  const topProducts = [...productAgg.entries()]
    .map(([product_id, v]) => ({
      product_id,
      title: v.title,
      units_sold: v.units,
      revenue: v.revenue,
    }))
    .sort((a, b) => b.units_sold - a.units_sold)
    .slice(0, 5)

  // Daily revenue series
  const dailyMap = new Map<string, { revenue: number; orders: number }>()
  for (let i = 0; i < days; i++) {
    const d = new Date(now - (days - 1 - i) * 86400_000)
    const key = d.toISOString().slice(0, 10)
    dailyMap.set(key, { revenue: 0, orders: 0 })
  }
  for (const o of inWindow) {
    const key = new Date(o.created_at).toISOString().slice(0, 10)
    const cur = dailyMap.get(key)
    if (cur) {
      cur.revenue += Number(o.total) || 0
      cur.orders += 1
    }
  }
  const dailyRevenue = [...dailyMap.entries()].map(([date, v]) => ({
    date,
    ...v,
  }))

  return {
    range: { from: fromIso, to: new Date(now).toISOString(), days },
    revenue: { total: revenue, previous: revenuePrev, currency },
    orders: { count: ordersCount, previous: prevWindow.length, aov },
    customers: {
      total_distinct: distinctCustomers.size,
      new_in_window: newCustomers,
    },
    fulfillment: buckets,
    payment_mix: mix,
    return_rate_pct: returnRatePct,
    rto_rate_pct: rtoRatePct,
    top_products: topProducts,
    daily_revenue: dailyRevenue,
  }
}
