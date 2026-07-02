import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { emailForUser, readTwoFactorByEmail, writeTwoFactorByEmail } from "../../../../lib/two-factor"
import { verifyTotp, generateBackupCodes } from "../../../../lib/totp"

/**
 * POST /admin/2fa/enable  { code }
 * Confirms enrolment: verifies the first TOTP code against the pending secret,
 * then activates 2FA and returns a fresh set of one-time backup codes. The
 * backup codes are shown ONCE here and stored only as hashes.
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

  const code = (req.body as any)?.code?.toString().trim()
  if (!code) {
    return res.status(400).json({ message: "A verification code is required." })
  }

  const state = await readTwoFactorByEmail(req.scope, email)
  if (state.enabled) {
    return res.status(409).json({ message: "Two-factor is already enabled." })
  }
  if (!state.pendingSecret) {
    return res.status(409).json({
      message: "No pending enrolment. Start with /admin/2fa/setup.",
    })
  }

  if (!verifyTotp(code, state.pendingSecret)) {
    return res.status(400).json({ message: "That code is incorrect or expired." })
  }

  const { plain, hashed } = generateBackupCodes()
  await writeTwoFactorByEmail(req.scope, email, {
    totp_secret: state.pendingSecret,
    totp_enabled: true,
    totp_pending_secret: undefined,
    totp_backup_codes: hashed,
    totp_enrolled_at: new Date().toISOString(),
  })

  return res.json({
    enabled: true,
    backup_codes: plain, // shown once — the user must save these now
  })
}
