import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { actorHasPermission } from "../../../../../../../lib/rbac"
import { deductGiftWrapStock } from "../../../../../../../lib/gift-wrap-deduct"

/**
 * POST /admin/packing/orders/:id/items/:itemId
 * Body: { packed: boolean, gift_wrappers_used?: number }
 *
 * Toggles a single line item's packed state. When this toggle results in
 * every item being packed and the order is gift-wrapped, the wrapper count
 * must be recorded in the same call (mirrors the old ops-status "packed"
 * stage) — it's deducted from stock right here, once, on that transition.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!(await actorHasPermission(req, "shipping.write"))) {
    return res.status(403).json({ message: "Forbidden" })
  }

  const orderId = req.params.id
  const itemId = req.params.itemId
  const { packed, gift_wrappers_used } = (req.body || {}) as {
    packed?: boolean
    gift_wrappers_used?: number
  }
  if (typeof packed !== "boolean") {
    return res.status(400).json({ message: "packed (boolean) is required" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: ["id", "metadata", "items.id"],
  })
  const order = (orders as any[])?.[0]
  if (!order) return res.status(404).json({ message: "Order not found" })

  const itemIds = new Set(((order.items as any[]) || []).map((i) => i.id))
  if (!itemIds.has(itemId)) {
    return res.status(404).json({ message: "Item not found on this order" })
  }

  const prevMeta = (order.metadata as any) || {}
  const packing = prevMeta.packing
  if (!packing?.fulfillment_id) {
    return res.status(400).json({ message: "Start packing before marking items packed" })
  }

  const prevPacked: string[] = Array.isArray(packing.packed_item_ids)
    ? packing.packed_item_ids
    : []
  const nextPacked = packed
    ? Array.from(new Set([...prevPacked, itemId]))
    : prevPacked.filter((id) => id !== itemId)

  const allPacked = nextPacked.length === itemIds.size
  const isGiftWrapped = !!prevMeta.gift_wrap
  const alreadyDeducted = prevMeta.gift_wrappers_used != null

  if (allPacked && isGiftWrapped && !alreadyDeducted && gift_wrappers_used == null) {
    return res.status(400).json({
      message: "This order is gift-wrapped — record how many wrappers were used.",
      code: "gift_wrappers_required",
    })
  }
  let wrapperCount: number | null = null
  if (allPacked && isGiftWrapped && !alreadyDeducted && gift_wrappers_used != null) {
    const n = Number(gift_wrappers_used)
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      return res.status(400).json({
        message: "gift_wrappers_used must be a whole number between 0 and 100",
      })
    }
    wrapperCount = n
  }

  const actorId = (req as any).auth_context?.actor_id || null
  let actorEmail: string | null = null
  if (actorId) {
    try {
      const userModule: any = req.scope.resolve(Modules.USER)
      const [u] = await userModule.listUsers({ id: actorId })
      actorEmail = u?.email || null
    } catch {}
  }

  const nowIso = new Date().toISOString()

  /**
   * One line per item, reflecting where it stands now — not a transcript of
   * every tick. A packer correcting a mis-click used to leave "Marked an item
   * packed / Unmarked an item as packed" pairs that buried the events that
   * actually matter. So: packing records the line, unpacking removes it.
   */
  const prevHistory = Array.isArray(packing.history) ? packing.history : []
  const history = prevHistory.filter(
    (h: any) =>
      h?.step !== `item_packed:${itemId}` && h?.step !== `item_unpacked:${itemId}`
  )
  if (packed) {
    history.push({
      step: `item_packed:${itemId}`,
      at: nowIso,
      actor_id: actorId,
      actor_email: actorEmail,
    })
  }

  const orderModule: any = req.scope.resolve(Modules.ORDER)
  await orderModule.updateOrders([
    {
      id: orderId,
      metadata: {
        ...prevMeta,
        packing: { ...packing, packed_item_ids: nextPacked, history },
        ...(wrapperCount != null
          ? { gift_wrappers_used: wrapperCount, gift_wrappers_used_at: nowIso }
          : {}),
      },
    },
  ])

  let stockLeft: number | null = null
  if (wrapperCount != null && wrapperCount > 0) {
    stockLeft = await deductGiftWrapStock(req.scope, wrapperCount)
  }

  return res.json({
    packed_item_ids: nextPacked,
    all_packed: allPacked,
    ...(wrapperCount != null ? { gift_wrappers_used: wrapperCount } : {}),
    ...(stockLeft != null ? { gift_wrap_stock_remaining: stockLeft } : {}),
  })
}
