import { model } from "@medusajs/framework/utils"

/**
 * An in-store appointment (a customer booking a slot to visit the Chandigarh
 * store). Date + slot are stored as IST wall-clock strings ("YYYY-MM-DD" /
 * "HH:MM") to avoid timezone drift — the store is single-location IST.
 *
 * A booking holds its slot the moment it's created (status "confirmed"); admin
 * can mark it completed/cancelled. Capacity is counted over every row whose
 * status is not "cancelled".
 */
const Appointment = model.define("appointment", {
  id: model.id().primaryKey(),
  reference: model.text().unique(), // short human code, e.g. "APT-7Q4K2"
  name: model.text(),
  email: model.text(),
  phone: model.text(),
  service_type: model.text(), // "Browse & try-on" | "Custom design" | "Repair / valuation" | "Other"
  date: model.text(), // "YYYY-MM-DD" (IST)
  slot: model.text(), // "HH:MM" (IST, 24h)
  status: model
    .enum(["confirmed", "completed", "cancelled"])
    .default("confirmed"),
  notes: model.text().nullable(),
  customer_id: model.text().nullable(), // set when booked while logged in
  cancelled_reason: model.text().nullable(),
})

export default Appointment
