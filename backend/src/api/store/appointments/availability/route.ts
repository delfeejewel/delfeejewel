import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import {
  getSettings,
  takenCountsForDate,
  computeAvailability,
  istToday,
  isValidDate,
  SERVICE_TYPES,
} from "../../../../lib/appointment"

/**
 * GET /store/appointments/availability?date=YYYY-MM-DD
 * Open slots for a date (IST). Without a date, returns config the booking form
 * needs (service types, horizon, today) so it can render the date picker.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const date = (req.query.date as string) || ""
  const settings = await getSettings(req.scope as any)

  if (!date) {
    return res.json({
      enabled: settings.enabled,
      service_types: SERVICE_TYPES,
      today: istToday(),
      horizon_days: settings.horizon_days,
      slot_minutes: settings.slot_minutes,
    })
  }

  if (!isValidDate(date)) {
    return res.status(400).json({ message: "Invalid date. Use YYYY-MM-DD." })
  }

  const taken = await takenCountsForDate(req.scope as any, date)
  const availability = computeAvailability(date, settings, taken)
  return res.json(availability)
}
