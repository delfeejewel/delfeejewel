import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export type VelocityEntry = {
  product_id: string
  title: string
  thumbnail: string | null
  units_sold: number
  revenue: number
}

export type ProductVelocityResult = {
  range: { days: number; from: string; to: string }
  fast: VelocityEntry[]
  slow: VelocityEntry[]
  total_products: number
  products_with_sales: number
}

/**
 * Aggregates units sold per product over a window and ranks them.
 *   fast = highest units_sold first (top `limit`)
 *   slow = lowest units_sold first, including products with zero sales (top `limit`)
 *
 * Products with no sales appear in `slow` with units_sold = 0.
 */
export async function computeProductVelocity(
  container: MedusaContainer,
  opts?: { days?: number; limit?: number }
): Promise<ProductVelocityResult> {
  const days = Math.max(1, Math.min(365, opts?.days || 30))
  const limit = Math.max(1, Math.min(50, opts?.limit || 10))
  const now = Date.now()
  const fromIso = new Date(now - days * 86400_000).toISOString()
  const toIso = new Date(now).toISOString()

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // Orders in window
  const { data: orders } = await query.graph({
    entity: "order",
    filters: { created_at: { $gte: fromIso } as any },
    fields: [
      "id",
      "created_at",
      "canceled_at",
      "items.title",
      "items.product_id",
      "items.quantity",
      "items.unit_price",
    ],
  })

  const agg = new Map<string, { units: number; revenue: number; title: string }>()
  for (const o of (orders as any[]) || []) {
    if (o.canceled_at) continue
    for (const item of (o.items as any[]) || []) {
      const pid = item.product_id
      if (!pid) continue
      const cur = agg.get(pid) || { units: 0, revenue: 0, title: item.title || "" }
      cur.units += Number(item.quantity || 0)
      cur.revenue +=
        Number(item.unit_price || 0) * Number(item.quantity || 0)
      if (!cur.title) cur.title = item.title || ""
      agg.set(pid, cur)
    }
  }

  // Full product catalogue (we need products with zero sales for the slow list)
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "thumbnail", "status"],
  })

  const entries: VelocityEntry[] = []
  let productsWithSales = 0
  for (const p of (products as any[]) || []) {
    if (p.status && p.status !== "published") continue
    const sold = agg.get(p.id)
    const units = sold?.units || 0
    if (units > 0) productsWithSales += 1
    entries.push({
      product_id: p.id,
      title: p.title || sold?.title || "Untitled",
      thumbnail: p.thumbnail || null,
      units_sold: units,
      revenue: sold?.revenue || 0,
    })
  }

  const fast = [...entries]
    .filter((e) => e.units_sold > 0)
    .sort((a, b) => b.units_sold - a.units_sold || b.revenue - a.revenue)
    .slice(0, limit)

  const slow = [...entries]
    .sort((a, b) => a.units_sold - b.units_sold || a.revenue - b.revenue)
    .slice(0, limit)

  return {
    range: { days, from: fromIso, to: toIso },
    fast,
    slow,
    total_products: entries.length,
    products_with_sales: productsWithSales,
  }
}
