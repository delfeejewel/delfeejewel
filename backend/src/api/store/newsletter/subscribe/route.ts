import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { MARKETING_MODULE } from "../../../../modules/marketing"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /store/newsletter/subscribe  { email, source? }
 * Single opt-in newsletter signup. Upserts the subscriber: re-subscribes a
 * previously-unsubscribed email, idempotent for an already-subscribed one.
 * Always returns a generic success (never reveals whether the email existed).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as Record<string, string>
  const email = (body.email || "").toLowerCase().trim()
  const source = (body.source || "footer").slice(0, 60)

  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ message: "Please enter a valid email address." })
  }

  const marketing: any = req.scope.resolve(MARKETING_MODULE)

  const existing = await marketing.listNewsletterSubscribers({ email })
  const row = existing?.[0]

  if (!row) {
    await marketing.createNewsletterSubscribers({
      email,
      status: "subscribed",
      source,
      consent_at: new Date(),
    })
  } else if (row.status === "unsubscribed") {
    await marketing.updateNewsletterSubscribers({
      id: row.id,
      status: "subscribed",
      consent_at: new Date(),
      unsubscribed_at: null,
    })
  }
  // already subscribed → no-op

  return res.json({ success: true })
}
