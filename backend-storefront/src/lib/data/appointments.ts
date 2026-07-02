"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "./cookies"

export type DaySlot = { time: string; available: number; capacity: number }
export type DayAvailability = {
  date: string
  open: boolean
  reason?: string
  slot_minutes: number
  slots: DaySlot[]
}
export type BookingConfig = {
  enabled: boolean
  service_types: string[]
  today: string
  horizon_days: number
  slot_minutes: number
}

/** Config the booking form needs to render (no date passed). */
export async function getBookingConfig(): Promise<BookingConfig> {
  return sdk.client.fetch(`/store/appointments/availability`, { method: "GET" })
}

/** Open slots for a specific date (YYYY-MM-DD, IST). */
export async function getAvailability(date: string): Promise<DayAvailability> {
  return sdk.client.fetch(`/store/appointments/availability`, {
    method: "GET",
    query: { date },
  })
}

export type BookingInput = {
  name: string
  email: string
  phone: string
  service_type: string
  date: string
  slot: string
  notes?: string
}

/**
 * Book an appointment. Runs server-side so a logged-in customer's auth token is
 * forwarded (attaching the booking to their account); guests book without it.
 */
export async function bookAppointment(
  input: BookingInput
): Promise<{ success: boolean; reference?: string; error?: string }> {
  try {
    const headers = { ...(await getAuthHeaders()) }
    const data = await sdk.client.fetch<{ appointment: { reference: string } }>(
      `/store/appointments`,
      { method: "POST", body: input, headers }
    )
    return { success: true, reference: data.appointment.reference }
  } catch (e: any) {
    // sdk.client.fetch throws a FetchError; prefer the API's JSON message, then
    // map known statuses to friendly copy, else a generic fallback.
    const status = e?.status ?? e?.response?.status
    const apiMsg = e?.response?.data?.message
    const msg =
      apiMsg ||
      (status === 409
        ? "That time was just taken — please pick another slot."
        : status === 429
        ? "You already have several upcoming appointments."
        : "Could not complete your booking. Please try again.")
    return { success: false, error: msg }
  }
}
