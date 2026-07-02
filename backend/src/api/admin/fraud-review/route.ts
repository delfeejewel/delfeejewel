import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/fraud-review
 * Lists orders the fraud engine flagged `fraud_status = needs_review`
 * (see subscribers/order-fraud-check.ts). An operator reviews each and
 * either clears it or cancels/refunds via the native order page.
 *
 * Gated by `orders.write` (lib/rbac.ts).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const rows: any[] = await knex("order")
    .whereRaw("metadata->>'fraud_status' = ?", ["needs_review"])
    .whereNull("canceled_at")
    .select("id", "display_id", "email", "currency_code", "metadata", "created_at")
    // Highest score first, then most recent.
    .orderByRaw("(metadata->>'fraud_score')::int desc nulls last")
    .orderBy("created_at", "desc")
    .limit(100)

  const ids = rows.map((r) => r.id)
  const itemsByOrder: Record<string, { title: string; quantity: number }[]> = {}
  const totalsByOrder: Record<string, number> = {}
  if (ids.length) {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "total", "items.title", "items.quantity"],
      filters: { id: ids },
    })
    for (const o of orders as any[]) {
      itemsByOrder[o.id] = (o.items || []).map((i: any) => ({
        title: i.title,
        quantity: i.quantity,
      }))
      totalsByOrder[o.id] = Number(o.total) || 0
    }
  }

  const flagged = rows.map((r) => {
    const m = (r.metadata as any) || {}
    return {
      order_id: r.id,
      display_id: r.display_id,
      email: r.email,
      currency_code: r.currency_code,
      total: totalsByOrder[r.id] ?? 0,
      score: Number(m.fraud_score ?? 0),
      band: m.fraud_band || "review",
      reasons: Array.isArray(m.fraud_reasons) ? m.fraud_reasons : [],
      checked_at: m.fraud_checked_at || r.created_at,
      created_at: r.created_at,
      items: itemsByOrder[r.id] || [],
    }
  })

  return res.json({ flagged, count: flagged.length })
}
