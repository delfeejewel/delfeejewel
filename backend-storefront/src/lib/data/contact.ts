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
 * Source of truth is the Supabase `contact_submissions` table (managed in the
 * CMS → Forms → Submissions). The storefront inserts with the anon key (RLS
 * allows insert-only). After storing, we best-effort ping the Medusa backend to
 * email the team — that hop must never block the submission from succeeding.
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

  // Best-effort team notification — never fail the submission on this.
  try {
    await sdk.client.fetch(`/store/contact`, {
      method: "POST",
      body: { name, email, phone, subject, message },
    })
  } catch {
    // Email is best-effort; the message is already captured in Supabase.
  }

  return { success: true, error: null }
}
