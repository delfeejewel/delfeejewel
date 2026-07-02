import { model } from "@medusajs/framework/utils"

/**
 * Store-wide booking availability config. A singleton — exactly one row, lazily
 * created with sensible defaults (see lib/appointment.ts `getSettings`). Admin
 * edits it from the Appointments page.
 *
 * weekdays: array of open weekday numbers, 0=Sun … 6=Sat (default Mon–Sat).
 * closed_dates: specific "YYYY-MM-DD" holidays the store is shut.
 */
const AppointmentSetting = model.define("appointment_setting", {
  id: model.id().primaryKey(),
  slot_minutes: model.number().default(30), // length of each bookable slot
  capacity_per_slot: model.number().default(1), // how many bookings per slot
  // json default is typed for objects; arrays serialise fine in jsonb (see migration).
  weekdays: model.json().default([1, 2, 3, 4, 5, 6] as any), // Mon–Sat
  open_time: model.text().default("11:00"), // IST 24h
  close_time: model.text().default("19:00"), // IST 24h (last slot starts before this)
  lead_hours: model.number().default(24), // min notice before a slot
  horizon_days: model.number().default(30), // how far ahead bookable
  closed_dates: model.json().default([] as any), // ["2026-07-04", …]
  enabled: model.boolean().default(true), // master on/off for bookings
})

export default AppointmentSetting
