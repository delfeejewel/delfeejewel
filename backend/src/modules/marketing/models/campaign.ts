import { model } from "@medusajs/framework/utils"

/**
 * A marketing email campaign authored in the admin.
 *
 * audience_type:
 *   - "subscribers"    → newsletter opt-in list (status subscribed)
 *   - "segment"        → customers in audience_segment (new/repeat/regular)
 *   - "all_customers"  → every customer with an email
 *   - "everyone"       → subscribers ∪ all customers
 * In every case the suppression list (unsubscribed emails) is excluded.
 *
 * status: draft → sending → sent (or failed). Counts are updated as the
 * background send progresses, so a campaign is resumable/observable mid-send.
 */
const Campaign = model.define("marketing_campaign", {
  id: model.id().primaryKey(),
  name: model.text(),
  subject: model.text(),
  body_html: model.text(),
  audience_type: model
    .enum(["subscribers", "segment", "all_customers", "everyone"])
    .default("subscribers"),
  audience_segment: model.enum(["new", "repeat", "regular"]).nullable(),
  status: model.enum(["draft", "sending", "sent", "failed"]).default("draft"),
  scheduled_at: model.dateTime().nullable(),
  total_recipients: model.number().default(0),
  sent_count: model.number().default(0),
  failed_count: model.number().default(0),
  sent_at: model.dateTime().nullable(),
  last_error: model.text().nullable(),
})

export default Campaign
