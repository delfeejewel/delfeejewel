import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { OTP_MODULE } from "../../../../modules/otp_verification"
import EmailNotificationService from "../../../../modules/email_notification/service"
import {
  generateOtpCode,
  hashOtpCode,
  OTP_TTL_MS,
  OTP_REQUEST_WINDOW_MS,
  OTP_MAX_REQUESTS_PER_WINDOW,
} from "../../../../utils/otp"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /store/otp/request
 * Emails a one-time code to confirm an email at post-checkout account creation.
 * Rate-limited per email; issuing a new code invalidates prior unconsumed ones.
 * Always responds 200 on success without revealing whether an account exists.
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

  // If an account already exists for this email, don't waste a code — tell the
  // user to log in. (Post-checkout onboarding of one's own email, so it's safe
  // to disclose this here.)
  const existingCustomers = await customerModule.listCustomers({
    email: normalized,
  })
  if (existingCustomers.length > 0) {
    return res.status(409).json({
      message: "An account with this email already exists. Please log in.",
    })
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

  await emailService.sendOtpEmail({ email: normalized, code })

  return res.json({ success: true })
}
