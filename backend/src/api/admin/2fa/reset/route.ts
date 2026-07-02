import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { getUserRole } from "../../../../lib/rbac"
import { emailForUser, clearTwoFactorByEmail } from "../../../../lib/two-factor"

/**
 * POST /admin/2fa/reset  { user_id }
 * Developer-only escape hatch: clears another user's 2FA so they can re-enrol
 * (e.g. lost authenticator + lost backup codes). Guarded at the handler level
 * — the RBAC middleware fails open on actor_id for some routes, so we re-check
 * the role here (same convention as the user-delete override).
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const actorId = req.auth_context?.actor_id
  if (!actorId) {
    return res.status(401).json({ message: "Not authenticated." })
  }

  const role = await getUserRole(req.scope as any, actorId)
  if (role !== "developer") {
    return res.status(403).json({
      message: "Access denied. Only developers can reset another user's 2FA.",
    })
  }

  const targetId = (req.body as any)?.user_id?.toString()
  if (!targetId) {
    return res.status(400).json({ message: "user_id is required." })
  }

  const email = await emailForUser(req.scope, targetId)
  if (!email) {
    return res.status(404).json({ message: "User not found." })
  }

  await clearTwoFactorByEmail(req.scope, email)
  return res.json({ user_id: targetId, two_factor_reset: true })
}
