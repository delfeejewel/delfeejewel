import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

import { updateInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows"

/** SKU of the gift-wrap service variant; wrapper stock lives on this item. */
const GIFT_WRAP_SKU = "GIFT-WRAP-INR-50"

import {
  OPS_STAGES,
  OpsHistoryEntry,
  OpsStatus,
  isOpsForwardProgress,
} from "../../../../../lib/ops-status"

/**
 * GET /admin/orders/:id/ops-status
 * Returns { status, history }.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const orderId = req.params.id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: ["id", "metadata"],
  })
  const order = (data as any[])?.[0]
  if (!order) return res.status(404).json({ message: "Order not found" })

  const meta = (order.metadata || {}) as any
  return res.json({
    status: (meta.ops_status as OpsStatus) || "pending",
    history: (meta.ops_history as OpsHistoryEntry[]) || [],
    gift_wrap: !!meta.gift_wrap,
    gift_wrappers_used: meta.gift_wrappers_used ?? null,
  })
}

/**
 * POST /admin/orders/:id/ops-status
 * Body: { status: OpsStatus, allow_skip?: boolean }
 *
 * Updates order.metadata.ops_status and appends an entry to
 * order.metadata.ops_history. Forward-progress only by default; pass
 * allow_skip=true to jump multiple stages or roll back (audit trail
 * still records who did it).
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const orderId = req.params.id
  const orderModule: any = req.scope.resolve(Modules.ORDER)
  const userModule: any = req.scope.resolve(Modules.USER)

  const { status, allow_skip, gift_wrappers_used } = (req.body || {}) as {
    status?: string
    allow_skip?: boolean
    gift_wrappers_used?: number
  }

  if (!status || !OPS_STAGES.includes(status as OpsStatus)) {
    return res.status(400).json({
      message: `status must be one of: ${OPS_STAGES.join(", ")}`,
    })
  }

  const [order] = await orderModule.listOrders({ id: orderId })
  if (!order) return res.status(404).json({ message: "Order not found" })

  const prev = ((order.metadata as any)?.ops_status as OpsStatus) || null
  const target = status as OpsStatus

  if (!allow_skip && prev && !isOpsForwardProgress(prev, target)) {
    return res.status(400).json({
      message: `Cannot move backward from "${prev}" to "${target}". Pass allow_skip=true to override.`,
    })
  }

  // ── Gift wrap: packers record how many wrappers they actually used, and we
  // deduct that from gift-wrap stock so wrapper inventory stays honest.
  // Required at the "packed" stage for gift-wrapped orders, because that is the
  // moment the wrappers are physically consumed.
  const prevMetaEarly = (order.metadata as any) || {}
  const isGiftWrapped = !!prevMetaEarly.gift_wrap
  const alreadyDeducted = prevMetaEarly.gift_wrappers_used != null

  if (isGiftWrapped && status === "packed" && !alreadyDeducted) {
    if (gift_wrappers_used == null) {
      return res.status(400).json({
        message: "This order is gift-wrapped — record how many wrappers were used.",
        code: "gift_wrappers_required",
      })
    }
    const n = Number(gift_wrappers_used)
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      return res.status(400).json({
        message: "gift_wrappers_used must be a whole number between 0 and 100",
      })
    }
  }

  // Resolve actor for audit trail
  const actorId = (req as any).auth_context?.actor_id || null
  let actorEmail: string | null = null
  if (actorId) {
    try {
      const [u] = await userModule.listUsers({ id: actorId })
      actorEmail = u?.email || null
    } catch {}
  }

  const nowIso = new Date().toISOString()
  const prevMeta = (order.metadata as any) || {}

  // Only deduct once per order — re-marking "packed" must not double-count.
  const deductWrappers =
    isGiftWrapped && target === "packed" && !alreadyDeducted && gift_wrappers_used != null
      ? Number(gift_wrappers_used)
      : null
  const history: OpsHistoryEntry[] = Array.isArray(prevMeta.ops_history)
    ? prevMeta.ops_history
    : []
  history.push({
    status: target,
    at: nowIso,
    actor_id: actorId,
    actor_email: actorEmail,
  })

  await orderModule.updateOrders([
    {
      id: orderId,
      metadata: {
        ...prevMeta,
        ops_status: target,
        ops_status_at: nowIso,
        ops_history: history,
        ...(deductWrappers != null
          ? { gift_wrappers_used: deductWrappers, gift_wrappers_used_at: nowIso }
          : {}),
      },
    },
  ])

  // Deduct the wrappers from gift-wrap stock at the single location. Done
  // AFTER the metadata write so a stock failure can never lose the recorded
  // count — worst case stock drifts and is corrected from the Stock card,
  // which is far better than the packer's entry vanishing.
  let stockLeft: number | null = null
  if (deductWrappers != null && deductWrappers > 0) {
    try {
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      // Looked up as a standalone inventory item, NOT through the product:
      // the gift-wrap variant has manage_inventory off (so Medusa never
      // deducts a wrapper itself and double-counts the packer's entry), which
      // removes the variant→inventory link but leaves the item and its level.
      const { data: items } = await query.graph({
        entity: "inventory_item",
        fields: ["id", "location_levels.location_id", "location_levels.stocked_quantity"],
        filters: { sku: GIFT_WRAP_SKU } as any,
      })
      const item = (items as any[])[0]
      const level = (item?.location_levels || [])[0]
      if (item && level) {
        const next = Math.max(0, Number(level.stocked_quantity || 0) - deductWrappers)
        await updateInventoryLevelsWorkflow(req.scope).run({
          input: {
            updates: [
              {
                inventory_item_id: item.id,
                location_id: level.location_id,
                stocked_quantity: next,
              },
            ],
          },
        })
        stockLeft = next
      }
    } catch (e: any) {
      req.scope
        .resolve(ContainerRegistrationKeys.LOGGER)
        .error(`gift-wrap stock deduction failed for order ${orderId}: ${e.message}`)
    }
  }

  return res.json({
    ok: true,
    status: target,
    at: nowIso,
    actor_email: actorEmail,
    ...(deductWrappers != null ? { gift_wrappers_used: deductWrappers } : {}),
    ...(stockLeft != null ? { gift_wrap_stock_remaining: stockLeft } : {}),
  })
}
