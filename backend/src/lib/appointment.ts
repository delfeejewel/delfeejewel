/**
 * Appointment booking core — availability computation + validation.
 *
 * Everything is in IST wall-clock. The store is single-location (Chandigarh,
 * Asia/Kolkata) with no DST, so we use a fixed +05:30 offset instead of a
 * timezone library. Dates are "YYYY-MM-DD" and slots are "HH:MM" (24h) strings.
 */
import { APPOINTMENT_MODULE } from "../modules/appointment"

const IST_OFFSET_MIN = 330 // +05:30

export const SERVICE_TYPES = [
  "Browse & try-on",
  "Custom design consultation",
  "Repair / valuation",
  "Other",
] as const

export type AppointmentSettings = {
  id: string
  slot_minutes: number
  capacity_per_slot: number
  weekdays: number[]
  open_time: string
  close_time: string
  lead_hours: number
  horizon_days: number
  closed_dates: string[]
  enabled: boolean
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** "HH:MM" → minutes since midnight. */
function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}
function minToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** Epoch ms for an IST wall-clock date+time. */
function istEpoch(date: string, time: string): number {
  const [y, mo, d] = date.split("-").map(Number)
  const [h, mi] = time.split(":").map(Number)
  return Date.UTC(y, mo - 1, d, h, mi) - IST_OFFSET_MIN * 60_000
}

/** Today's date in IST as "YYYY-MM-DD". */
export function istToday(now = Date.now()): string {
  return new Date(now + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 10)
}

/** Weekday (0=Sun..6=Sat) of an IST calendar date. */
function weekdayOf(date: string): number {
  const [y, mo, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay()
}

/** Lazily fetch the singleton settings row, creating defaults on first use. */
export async function getSettings(container: any): Promise<AppointmentSettings> {
  const service: any = container.resolve(APPOINTMENT_MODULE)
  const rows = await service.listAppointmentSettings({})
  if (rows?.length) return rows[0]
  const created = await service.createAppointmentSettings({})
  return Array.isArray(created) ? created[0] : created
}

export async function updateSettings(
  container: any,
  patch: Partial<AppointmentSettings>
): Promise<AppointmentSettings> {
  const service: any = container.resolve(APPOINTMENT_MODULE)
  const current = await getSettings(container)
  const updated = await service.updateAppointmentSettings({
    id: current.id,
    ...patch,
  })
  return Array.isArray(updated) ? updated[0] : updated
}

/** All slot start-times ("HH:MM") the store theoretically runs on a given day. */
export function allSlotsForDay(s: AppointmentSettings): string[] {
  const start = timeToMin(s.open_time)
  const end = timeToMin(s.close_time)
  const step = Math.max(5, s.slot_minutes)
  const out: string[] = []
  // last slot must START at or before (close - step) so it fits before closing
  for (let t = start; t + step <= end; t += step) out.push(minToTime(t))
  return out
}

export type DayAvailability = {
  date: string
  open: boolean
  reason?: string
  slot_minutes: number
  slots: { time: string; available: number; capacity: number }[]
}

/**
 * Compute bookable slots for one date given the settings and a map of
 * slot → existing (non-cancelled) booking count.
 */
export function computeAvailability(
  date: string,
  s: AppointmentSettings,
  takenBySlot: Record<string, number>,
  now = Date.now()
): DayAvailability {
  const base = { date, slot_minutes: s.slot_minutes }

  if (!s.enabled) return { ...base, open: false, reason: "Booking is currently closed.", slots: [] }
  if (!DATE_RE.test(date)) return { ...base, open: false, reason: "Invalid date.", slots: [] }

  const today = istToday(now)
  if (date < today) return { ...base, open: false, reason: "That date has passed.", slots: [] }

  const maxDate = istToday(now + s.horizon_days * 86_400_000)
  if (date > maxDate)
    return { ...base, open: false, reason: `Bookings open up to ${s.horizon_days} days ahead.`, slots: [] }

  if (!s.weekdays.includes(weekdayOf(date)))
    return { ...base, open: false, reason: "The store is closed on this day.", slots: [] }

  if ((s.closed_dates || []).includes(date))
    return { ...base, open: false, reason: "The store is closed on this date.", slots: [] }

  const earliest = now + s.lead_hours * 3_600_000
  const slots = allSlotsForDay(s)
    .filter((time) => istEpoch(date, time) >= earliest) // respect lead time / past slots
    .map((time) => {
      const taken = takenBySlot[time] || 0
      return { time, capacity: s.capacity_per_slot, available: Math.max(0, s.capacity_per_slot - taken) }
    })
    .filter((sl) => sl.available > 0)

  return { ...base, open: slots.length > 0, slots, reason: slots.length ? undefined : "No open slots on this date." }
}

/** Count non-cancelled bookings per slot for a date. */
export async function takenCountsForDate(
  container: any,
  date: string
): Promise<Record<string, number>> {
  const service: any = container.resolve(APPOINTMENT_MODULE)
  const rows = await service.listAppointments({
    date,
    status: ["confirmed", "completed"],
  })
  const out: Record<string, number> = {}
  for (const r of rows) out[r.slot] = (out[r.slot] || 0) + 1
  return out
}

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no ambiguous 0/O/1/I
export function makeReference(): string {
  let code = ""
  for (let i = 0; i < 5; i++)
    code += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)]
  return `APT-${code}`
}

export const isValidDate = (d: string) => DATE_RE.test(d)
export const isValidTime = (t: string) => TIME_RE.test(t)
