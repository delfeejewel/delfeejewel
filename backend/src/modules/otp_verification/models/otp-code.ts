import { model } from "@medusajs/framework/utils"

/**
 * A short-lived one-time code emailed to confirm ownership of an email address
 * during post-checkout account creation. Codes are stored hashed; expiry and
 * attempt limits are enforced in the route handlers.
 */
const OtpCode = model.define("otp_code", {
  id: model.id().primaryKey(),
  email: model.text(),
  code_hash: model.text(),
  expires_at: model.dateTime(),
  consumed_at: model.dateTime().nullable(),
  attempts: model.number().default(0),
})

export default OtpCode
