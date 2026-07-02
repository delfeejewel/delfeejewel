import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { APPOINTMENT_MODULE } from "../../../modules/appointment"
import { istToday } from "../../../lib/appointment"

/**
 * GET /admin/appointments?status=&date=&from=&scope=upcoming|all
 * Lists bookings for the admin queue, newest-relevant first.
 * RBAC: gated by `appointments.write` via PATH_PERMISSIONS (this is a custom
 * top-level admin route, so the middleware reliably has actor_id here).
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const service: any = req.scope.resolve(APPOINTMENT_MODULE)

  const status = req.query.status as string | undefined
  const date = req.query.date as string | undefined
  const view = (req.query.scope as string) || "upcoming"

  const filters: Record<string, any> = {}
  if (status) filters.status = status
  if (date) filters.date = date
  else if (view === "upcoming") filters.date = { $gte: istToday() }

  const appointments = await service.listAppointments(filters, {
    order: { date: "ASC", slot: "ASC" },
    take: 500,
  })

  // Lightweight totals for the header.
  const all = await service.listAppointments({}, { take: 5000 })
  const totals = {
    confirmed: all.filter((a: any) => a.status === "confirmed").length,
    completed: all.filter((a: any) => a.status === "completed").length,
    cancelled: all.filter((a: any) => a.status === "cancelled").length,
    upcoming: all.filter(
      (a: any) => a.status === "confirmed" && a.date >= istToday()
    ).length,
  }

  return res.json({ appointments, totals })
}
