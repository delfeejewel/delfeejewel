import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { emailForUser, readTwoFactorByEmail } from "../../../../lib/two-factor"

/**
 * GET /admin/2fa/status — the current admin's own 2FA enrolment state.
 * Any authenticated admin may read their own status.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const userId = req.auth_context?.actor_id
  const email = userId ? await emailForUser(req.scope, userId) : null
  if (!email) {
    return res.status(401).json({ message: "Not authenticated." })
  }

  const state = await readTwoFactorByEmail(req.scope, email)
  return res.json({
    enabled: state.enabled,
    pending: !!state.pendingSecret && !state.enabled,
    backup_codes_remaining: state.backupHashes.length,
    enrolled_at: state.enrolledAt ?? null,
  })
}
