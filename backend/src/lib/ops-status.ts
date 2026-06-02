/**
 * Operational status for fulfillment workflow.
 *
 * Lives in order.metadata.ops_status. Progresses linearly through the stages
 * below — once an order is "handed_over" it's out of the warehouse's hands
 * and Shiprocket tracks it from there. The Shiprocket webhook still updates
 * order.metadata.shiprocket_status (delivered, RTO, etc.) — those are the
 * post-handover statuses; ops_status is for the pre-handover warehouse work.
 */

export const OPS_STAGES = [
  "pending",
  "picked",
  "packed",
  "awb_assigned",
  "handed_over",
] as const

export type OpsStatus = (typeof OPS_STAGES)[number]

export const OPS_STAGE_LABEL: Record<OpsStatus, string> = {
  pending: "Pending pick",
  picked: "Picked",
  packed: "Packed",
  awb_assigned: "AWB assigned",
  handed_over: "Handed over",
}

export const OPS_STAGE_VERB: Record<OpsStatus, string> = {
  pending: "Mark pending",
  picked: "Mark picked",
  packed: "Mark packed",
  awb_assigned: "Mark AWB assigned",
  handed_over: "Mark handed over",
}

export const OPS_STAGE_HINT: Record<OpsStatus, string> = {
  pending: "Order placed, awaiting picker.",
  picked: "Items pulled from inventory and assembled.",
  packed: "Securely packed; gift wrap applied if requested.",
  awb_assigned: "Shiprocket AWB generated and label printed.",
  handed_over: "Handed off to the courier — Shiprocket tracks from here.",
}

export function nextOpsStage(current: OpsStatus | null): OpsStatus | null {
  const safe: OpsStatus = current && OPS_STAGES.includes(current) ? current : "pending"
  const idx = OPS_STAGES.indexOf(safe)
  if (idx < 0 || idx >= OPS_STAGES.length - 1) return null
  return OPS_STAGES[idx + 1]
}

export function isOpsForwardProgress(
  from: OpsStatus | null,
  to: OpsStatus
): boolean {
  const fromIdx = from ? OPS_STAGES.indexOf(from) : -1
  const toIdx = OPS_STAGES.indexOf(to)
  return toIdx > fromIdx
}

export function opsStageIndex(s: OpsStatus | null): number {
  if (!s || !OPS_STAGES.includes(s)) return -1
  return OPS_STAGES.indexOf(s)
}

export type OpsHistoryEntry = {
  status: OpsStatus
  at: string
  actor_id?: string | null
  actor_email?: string | null
}
