"use server"

import { sdk } from "@lib/config"

type ContactInput = {
  name: string
  email: string
  phone?: string
  subject?: string
  message: string
}

/**
 * Submits a Contact Us message to the backend (public endpoint).
 */
export async function sendContactMessage(
  data: ContactInput
): Promise<{ success: boolean; error: string | null }> {
  try {
    await sdk.client.fetch(`/store/contact`, {
      method: "POST",
      body: data,
    })
    return { success: true, error: null }
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || "Could not send your message. Please try again.",
    }
  }
}
