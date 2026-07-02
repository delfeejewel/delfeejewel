import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import {
  getSettings,
  updateSettings,
  isValidDate,
  isValidTime,
} from "../../../../lib/appointment"
import { actorHasPermission } from "../../../../lib/rbac"

/**
 * GET  /admin/appointments/settings  → current availability config (singleton)
 * POST /admin/appointments/settings  → update it (validated)
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const settings = await getSettings(req.scope as any)
  return res.json({ settings })
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!(await actorHasPermission(req, "appointments.write"))) {
    return res.status(403).json({ message: "Access denied. Appointments permission required." })
  }

  const b = (req.body || {}) as Record<string, any>
  const patch: Record<string, any> = {}

  if (b.slot_minutes !== undefined) {
    const n = Number(b.slot_minutes)
    if (!Number.isInteger(n) || n < 5 || n > 240)
      return res.status(400).json({ message: "Slot length must be 5–240 minutes." })
    patch.slot_minutes = n
  }
  if (b.capacity_per_slot !== undefined) {
    const n = Number(b.capacity_per_slot)
    if (!Number.isInteger(n) || n < 1 || n > 100)
      return res.status(400).json({ message: "Capacity must be 1–100." })
    patch.capacity_per_slot = n
  }
  if (b.weekdays !== undefined) {
    if (!Array.isArray(b.weekdays) || b.weekdays.length === 0 || b.weekdays.some((d: any) => !Number.isInteger(d) || d < 0 || d > 6))
      return res.status(400).json({ message: "Pick at least one open day (0–6)." })
    patch.weekdays = [...new Set(b.weekdays)].sort()
  }
  if (b.open_time !== undefined || b.close_time !== undefined) {
    const open = b.open_time ?? (await getSettings(req.scope as any)).open_time
    const close = b.close_time ?? (await getSettings(req.scope as any)).close_time
    if (!isValidTime(open) || !isValidTime(close))
      return res.status(400).json({ message: "Times must be HH:MM (24h)." })
    if (open >= close)
      return res.status(400).json({ message: "Opening time must be before closing time." })
    patch.open_time = open
    patch.close_time = close
  }
  if (b.lead_hours !== undefined) {
    const n = Number(b.lead_hours)
    if (!Number.isInteger(n) || n < 0 || n > 720)
      return res.status(400).json({ message: "Lead time must be 0–720 hours." })
    patch.lead_hours = n
  }
  if (b.horizon_days !== undefined) {
    const n = Number(b.horizon_days)
    if (!Number.isInteger(n) || n < 1 || n > 365)
      return res.status(400).json({ message: "Horizon must be 1–365 days." })
    patch.horizon_days = n
  }
  if (b.closed_dates !== undefined) {
    if (!Array.isArray(b.closed_dates) || b.closed_dates.some((d: any) => !isValidDate(d)))
      return res.status(400).json({ message: "closed_dates must be YYYY-MM-DD strings." })
    patch.closed_dates = [...new Set(b.closed_dates)].sort()
  }
  if (b.enabled !== undefined) {
    if (typeof b.enabled !== "boolean")
      return res.status(400).json({ message: "enabled must be true or false." })
    patch.enabled = b.enabled
  }

  const settings = await updateSettings(req.scope as any, patch)
  return res.json({ settings })
}
