import { model } from "@medusajs/framework/utils"

/**
 * A newsletter subscriber. Email is the natural key (unique). Single opt-in:
 * a row with status "subscribed" is created on signup. Unsubscribing flips the
 * status and stamps unsubscribed_at — we keep the row (never hard-delete) so the
 * email stays on the suppression list and is never re-mailed by mistake.
 */
const NewsletterSubscriber = model.define("newsletter_subscriber", {
  id: model.id().primaryKey(),
  email: model.text().unique(),
  status: model.enum(["subscribed", "unsubscribed"]).default("subscribed"),
  source: model.text().nullable(),
  customer_id: model.text().nullable(),
  consent_at: model.dateTime().nullable(),
  unsubscribed_at: model.dateTime().nullable(),
})

export default NewsletterSubscriber
