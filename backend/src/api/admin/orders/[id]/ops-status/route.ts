import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

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

  const { status, allow_skip } = (req.body || {}) as {
    status?: string
    allow_skip?: boolean
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
      },
    },
  ])

  return res.json({
    ok: true,
    status: target,
    at: nowIso,
    actor_email: actorEmail,
  })
}
