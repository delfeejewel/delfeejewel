"use server"

import { supabase } from "@lib/supabase"
import { sdk } from "@lib/config"

type ContactInput = {
  name: string
  email: string
  phone?: string
  subject?: string
  message: string
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Submits a Contact Us message.
 *
 * The Medusa backend owns this: POST /store/contact writes the row to
 * `contact_submissions` over Postgres (shown in CMS → Forms → Submissions) and
 * emails the team.
 *
 * It used to be the other way round — insert here via the Supabase REST API
 * with the anon key, then ping the backend as a nicety. That made the form
 * depend on a service path that returns 402 the moment the Supabase project
 * exceeds its free-tier quota, so the form broke while the database was fine.
 * Postgres is the connection the backend already relies on, so it fails only
 * when the store is down anyway.
 *
 * The direct Supabase insert is kept as a FALLBACK for the reverse case: the
 * backend unreachable while Supabase is healthy.
 */
export async function sendContactMessage(
  data: ContactInput
): Promise<{ success: boolean; error: string | null }> {
  const name = data.name?.trim()
  const email = data.email?.trim()
  const message = data.message?.trim()

  if (!name || !email || !message) {
    return { success: false, error: "Please fill in your name, email and message." }
  }
  if (!EMAIL_RE.test(email)) {
    return { success: false, error: "Please enter a valid email address." }
  }

  const phone = data.phone?.trim() || null
  const subject = data.subject?.trim() || null

  // Primary path — the backend stores the row and emails the team.
  try {
    await sdk.client.fetch(`/store/contact`, {
      method: "POST",
      body: { name, email, phone, subject, message },
    })
    return { success: true, error: null }
  } catch {
    // fall through to the Supabase fallback below
  }

  // Fallback — backend unreachable. Try the REST insert directly so the message
  // is still captured; the team just won't get the notification email.
  const { error } = await supabase.from("contact_submissions").insert({
    name: name.slice(0, 200),
    email: email.slice(0, 200),
    phone: phone?.slice(0, 50) || null,
    subject: subject?.slice(0, 200) || null,
    message: message.slice(0, 5000),
  })

  if (error) {
    return {
      success: false,
      error: "Could not send your message. Please try again.",
    }
  }

  return { success: true, error: null }
}
