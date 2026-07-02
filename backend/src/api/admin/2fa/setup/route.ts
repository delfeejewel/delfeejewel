import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import QRCode from "qrcode"

import { emailForUser, readTwoFactorByEmail, writeTwoFactorByEmail } from "../../../../lib/two-factor"
import { generateTotpSecret, buildOtpAuthUrl } from "../../../../lib/totp"

/**
 * POST /admin/2fa/setup — begin enrolment. Generates a fresh secret, stages it
 * as `totp_pending_secret` (NOT yet active), and returns the otpauth URI + a QR
 * data-URL for the authenticator app. The user must confirm a code via
 * /admin/2fa/enable before 2FA is actually enforced.
 *
 * Idempotent: re-running before confirmation issues a new pending secret.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const userId = req.auth_context?.actor_id
  const email = userId ? await emailForUser(req.scope, userId) : null
  if (!email) {
    return res.status(401).json({ message: "Not authenticated." })
  }

  const state = await readTwoFactorByEmail(req.scope, email)
  if (state.enabled) {
    return res.status(409).json({
      message: "Two-factor authentication is already enabled. Disable it first to re-enrol.",
    })
  }

  const secret = generateTotpSecret()
  await writeTwoFactorByEmail(req.scope, email, { totp_pending_secret: secret })

  const otpauthUrl = buildOtpAuthUrl(email, secret)
  const qr = await QRCode.toDataURL(otpauthUrl)

  return res.json({
    secret, // shown for manual entry
    otpauth_url: otpauthUrl,
    qr, // data:image/png;base64,... for an <img>
  })
}
