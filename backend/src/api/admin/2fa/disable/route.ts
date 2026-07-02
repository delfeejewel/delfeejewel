import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import {
  emailForUser,
  readTwoFactorByEmail,
  clearTwoFactorByEmail,
} from "../../../../lib/two-factor"
import { verifyTotp, consumeBackupCode } from "../../../../lib/totp"

/**
 * POST /admin/2fa/disable  { code }
 * Turns off the current admin's 2FA. Requires a valid current TOTP or backup
 * code so a hijacked but un-verified session can't silently remove the factor.
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
  const state = await readTwoFactorByEmail(req.scope, email)
  if (!state.enabled) {
    return res.json({ enabled: false }) // already off — no-op
  }
  if (!code) {
    return res.status(400).json({ message: "A current code is required to disable 2FA." })
  }

  const validTotp = state.secret && verifyTotp(code, state.secret)
  const validBackup = consumeBackupCode(code, state.backupHashes).ok
  if (!validTotp && !validBackup) {
    return res.status(400).json({ message: "That code is incorrect or expired." })
  }

  await clearTwoFactorByEmail(req.scope, email)
  return res.json({ enabled: false })
}
