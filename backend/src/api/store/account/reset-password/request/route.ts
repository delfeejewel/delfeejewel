import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { OTP_MODULE } from "../../../../../modules/otp_verification"
import EmailNotificationService from "../../../../../modules/email_notification/service"
import {
  generateOtpCode,
  hashOtpCode,
  OTP_TTL_MS,
  OTP_REQUEST_WINDOW_MS,
  OTP_MAX_REQUESTS_PER_WINDOW,
} from "../../../../../utils/otp"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /store/account/reset-password/request
 * Emails a one-time code to reset a forgotten password. A code is only issued
 * when a *registered* account exists for the email, but the endpoint always
 * responds 200 so it never reveals whether an account exists. Rate-limited per
 * email; issuing a new code invalidates prior unconsumed ones.
 *
 * Body: { email: string }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { email } = (req.body || {}) as { email?: string }
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ message: "A valid email address is required." })
  }
  const normalized = email.toLowerCase().trim()

  const otpModule: any = req.scope.resolve(OTP_MODULE)
  const emailService: EmailNotificationService =
    req.scope.resolve("email_notification")
  const customerModule = req.scope.resolve(Modules.CUSTOMER)
  const logger = req.scope.resolve("logger")

  // Only registered accounts can reset a password. If none exists we silently
  // succeed — no code, no email — so the response never reveals whether an
  // account exists. Guest customers (has_account=false) created at checkout
  // don't count.
  const existingCustomers = await customerModule.listCustomers({
    email: normalized,
  })
  const account = existingCustomers.find((c: any) => c.has_account)
  if (!account) {
    return res.json({ success: true })
  }

  const existing = await otpModule.listOtpCodes({ email: normalized })

  // Rate limit by recent issuance count
  const windowStart = Date.now() - OTP_REQUEST_WINDOW_MS
  const recentCount = existing.filter(
    (c: any) => new Date(c.created_at).getTime() > windowStart
  ).length
  if (recentCount >= OTP_MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      message: "Too many code requests. Please wait a few minutes and try again.",
    })
  }

  // Invalidate any still-active codes so only the newest one is valid
  const active = existing.filter((c: any) => !c.consumed_at)
  for (const c of active) {
    await otpModule.updateOtpCodes([{ id: c.id, consumed_at: new Date() }])
  }

  const code = generateOtpCode()
  await otpModule.createOtpCodes({
    email: normalized,
    code_hash: hashOtpCode(code),
    expires_at: new Date(Date.now() + OTP_TTL_MS),
    attempts: 0,
  })

  // Fire-and-forget: don't hold the HTTP response hostage to email delivery.
  // The OTP record is already persisted, so the user can proceed to the
  // code-entry step immediately. _send() swallows and logs its own errors; the
  // extra .catch guards against an unexpected throw (e.g. Supabase lookup).
  emailService
    .sendPasswordResetEmail({
      email: normalized,
      code,
      customer_name: account.first_name || undefined,
    })
    .catch((err: any) =>
      logger.error(
        `Password-reset email send failed for ${normalized}: ${err?.message}`
      )
    )

  return res.json({ success: true })
}
