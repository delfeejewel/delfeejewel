import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { APPOINTMENT_MODULE } from "../../../../modules/appointment"
import { actorHasPermission } from "../../../../lib/rbac"

// Terminal states are terminal. Reinstating a cancelled booking is deliberately
// NOT allowed — it would skip the capacity/lead/horizon re-checks and could
// overbook a slot that filled after the cancel. To re-book, create a new one.
const NEXT: Record<string, string[]> = {
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
}

/**
 * POST /admin/appointments/:id  { status, cancelled_reason? }
 * Move a booking through its lifecycle (confirm → completed/cancelled).
 * Emails the customer on confirm/cancel transitions (best-effort).
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  // The PATH_PERMISSIONS middleware fails open (no actor_id in its phase), so
  // gate this write in the handler (fails closed).
  if (!(await actorHasPermission(req, "appointments.write"))) {
    return res.status(403).json({ message: "Access denied. Appointments permission required." })
  }

  const { id } = req.params
  const body = (req.body || {}) as Record<string, string>
  const status = (body.status || "").trim()

  const service: any = req.scope.resolve(APPOINTMENT_MODULE)
  const existing = await service.retrieveAppointment(id).catch(() => null)
  if (!existing) return res.status(404).json({ message: "Appointment not found." })

  if (!["completed", "cancelled", "confirmed"].includes(status)) {
    return res.status(400).json({ message: "Invalid status." })
  }
  if (status !== existing.status && !NEXT[existing.status]?.includes(status)) {
    return res
      .status(400)
      .json({ message: `Cannot move from ${existing.status} to ${status}.` })
  }

  const patch: Record<string, any> = { id, status }
  if (status === "cancelled") patch.cancelled_reason = (body.cancelled_reason || "").trim() || null

  const updated = await service.updateAppointments(patch)
  const appointment = Array.isArray(updated) ? updated[0] : updated

  // Notify the customer when their booking is cancelled.
  if (status === "cancelled" && existing.status !== "cancelled") {
    try {
      const emailService: any = req.scope.resolve("email_notification")
      await emailService.sendAppointmentEmail({
        to: existing.email,
        kind: "cancelled",
        name: existing.name,
        reference: existing.reference,
        service_type: existing.service_type,
        date: existing.date,
        slot: existing.slot,
        reason: patch.cancelled_reason || undefined,
      })
    } catch {
      // ignore email errors
    }
  }

  return res.json({ appointment })
}
