import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { APPOINTMENT_MODULE } from "../../../modules/appointment"
import {
  getSettings,
  takenCountsForDate,
  computeAvailability,
  makeReference,
  isValidDate,
  isValidTime,
  istToday,
  SERVICE_TYPES,
} from "../../../lib/appointment"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+\d][\d\s-]{6,19}$/
const MAX_NAME = 120
const MAX_EMAIL = 200
const MAX_ACTIVE_PER_EMAIL = 5 // upcoming confirmed bookings one email may hold

/**
 * POST /store/appointments
 * Book an in-store visit. Guests allowed; a logged-in customer's id is attached.
 * Re-validates the slot against live availability at write time (so a slot that
 * filled up between page-load and submit is rejected rather than overbooked).
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const b = (req.body || {}) as Record<string, string>
  const name = (b.name || "").trim().slice(0, MAX_NAME)
  const email = (b.email || "").toLowerCase().trim().slice(0, MAX_EMAIL)
  const phone = (b.phone || "").trim()
  const service_type = (b.service_type || "").trim()
  const date = (b.date || "").trim()
  const slot = (b.slot || "").trim()
  const notes = (b.notes || "").trim().slice(0, 1000) || null

  // ── Field validation ──────────────────────────────────────────────────
  if (!name || name.length < 2) return res.status(400).json({ message: "Please enter your name." })
  if (!EMAIL_RE.test(email)) return res.status(400).json({ message: "Please enter a valid email address." })
  // Require a real phone: pattern + at least 8 digits (rejects "+--- ---").
  if (!PHONE_RE.test(phone) || (phone.match(/\d/g) || []).length < 8)
    return res.status(400).json({ message: "Please enter a valid phone number." })
  if (!SERVICE_TYPES.includes(service_type as any))
    return res.status(400).json({ message: "Please choose what the visit is for." })
  if (!isValidDate(date) || !isValidTime(slot))
    return res.status(400).json({ message: "Please pick a date and time slot." })

  // ── Slot must still be open (lead/horizon/closed-day + capacity) ──────
  const settings = await getSettings(req.scope as any)
  const taken = await takenCountsForDate(req.scope as any, date)
  const availability = computeAvailability(date, settings, taken)
  const openSlot = availability.slots.find((s) => s.time === slot)
  if (!availability.open || !openSlot) {
    return res.status(409).json({
      message:
        availability.reason ||
        "That time is no longer available — please pick another slot.",
    })
  }

  const service: any = req.scope.resolve(APPOINTMENT_MODULE)
  const customer_id = req.auth_context?.actor_id || null

  // ── Anti-abuse: cap upcoming bookings per email ───────────────────────
  const existingForEmail = await service.listAppointments(
    { email, status: "confirmed" },
    { take: MAX_ACTIVE_PER_EMAIL + 1 }
  )
  const upcoming = existingForEmail.filter((a: any) => a.date >= istToday())
  if (upcoming.length >= MAX_ACTIVE_PER_EMAIL) {
    return res.status(429).json({
      message:
        "You already have several upcoming appointments. Please contact us to add more.",
    })
  }

  // ── Create (retry on the rare reference collision) ────────────────────
  let appointment: any
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const created = await service.createAppointments({
          reference: makeReference(),
          name,
          email,
          phone,
          service_type,
          date,
          slot,
          status: "confirmed",
          notes,
          customer_id,
        })
        appointment = Array.isArray(created) ? created[0] : created
        break
      } catch (e: any) {
        const dup = /unique|duplicate|already exists/i.test(e?.message || "")
        if (dup && attempt < 5) continue // reference clash — new code, retry
        throw e
      }
    }
  } catch {
    return res
      .status(500)
      .json({ message: "Could not complete your booking. Please try again." })
  }

  // ── Capacity guard (closes the check-then-insert race) ────────────────
  // After inserting, re-list the slot's live (non-cancelled) bookings ordered
  // deterministically. If our row ranks beyond capacity, another booking beat
  // us — roll ours back and reject. Concurrent inserts converge: exactly the
  // earliest `capacity` survive, the rest self-cancel.
  const live = await service.listAppointments(
    { date, slot, status: ["confirmed", "completed"] },
    { order: { created_at: "ASC", id: "ASC" }, take: 1000 }
  )
  const rank = live.findIndex((a: any) => a.id === appointment.id)
  if (rank < 0 || rank >= settings.capacity_per_slot) {
    await service.deleteAppointments([appointment.id])
    return res.status(409).json({
      message: "That time was just taken — please pick another slot.",
    })
  }

  // ── Confirmation email (best-effort; never blocks the booking) ────────
  try {
    const emailService: any = req.scope.resolve("email_notification")
    await emailService.sendAppointmentEmail({
      to: email,
      kind: "booked",
      name,
      reference: appointment.reference,
      service_type,
      date,
      slot,
    })
  } catch {
    // email failure must not fail the booking
  }

  return res.status(201).json({
    appointment: {
      reference: appointment.reference,
      name: appointment.name,
      service_type: appointment.service_type,
      date: appointment.date,
      slot: appointment.slot,
      status: appointment.status,
    },
  })
}
