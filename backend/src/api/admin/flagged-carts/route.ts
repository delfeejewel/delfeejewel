import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/flagged-carts
 * Lists carts the webhook reconciler flagged as "paid but could not complete"
 * (reconcile_status = needs_review). These are captured payments with no order
 * — an operator must either retry completion or refund + dismiss.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const rows: any[] = await knex("cart")
    .whereRaw("metadata->>'reconcile_status' = ?", ["needs_review"])
    .whereNull("completed_at")
    .select("id", "email", "currency_code", "metadata", "updated_at")
    .orderBy("updated_at", "desc")
    .limit(100)

  const ids = rows.map((r) => r.id)
  const itemsByCart: Record<string, { title: string; quantity: number }[]> = {}
  if (ids.length) {
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: ["id", "items.title", "items.quantity"],
      filters: { id: ids },
    })
    for (const c of carts as any[]) {
      itemsByCart[c.id] = (c.items || []).map((i: any) => ({
        title: i.title,
        quantity: i.quantity,
      }))
    }
  }

  const flagged = rows.map((r) => {
    const m = (r.metadata as any) || {}
    return {
      cart_id: r.id,
      email: r.email,
      currency_code: r.currency_code,
      amount: Number(m.reconcile_amount ?? m.cod_upfront_amount ?? 0),
      is_cod_token: !!(m.reconcile_is_cod_token ?? m.cod_upfront_payment_id),
      payment_id: m.reconcile_payment_id || m.cod_upfront_payment_id || null,
      reason: m.reconcile_reason || "Unknown",
      flagged_at: m.reconcile_flagged_at || r.updated_at,
      items: itemsByCart[r.id] || [],
    }
  })

  return res.json({ flagged, count: flagged.length })
}
