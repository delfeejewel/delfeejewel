import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { getUserRole } from "../../../lib/rbac"
import {
  FLAG_DEFAULTS,
  getFeatureFlags,
  setFeatureFlags,
} from "../../../lib/feature-flags"

/**
 * GET /admin/feature-flags — flags + whether the caller may edit them.
 * POST /admin/feature-flags — update flags. HANDLER-level developer guard
 * (custom RBAC middleware fails open on some phases, so the check lives here).
 */

async function isDeveloper(req: AuthenticatedMedusaRequest): Promise<boolean> {
  const actorId = req.auth_context?.actor_id
  if (!actorId) return false
  const role = await getUserRole(req.scope as any, actorId)
  return role === "developer"
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const [flags, canManage] = await Promise.all([
    getFeatureFlags(req.scope),
    isDeveloper(req),
  ])
  return res.json({ flags, can_manage: canManage })
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!(await isDeveloper(req))) {
    return res.status(403).json({
      message: "Access denied. This action requires developer privileges.",
    })
  }

  const body = (req.body || {}) as Record<string, unknown>
  const updates: Record<string, boolean> = {}
  for (const key of Object.keys(FLAG_DEFAULTS)) {
    if (typeof body[key] === "boolean") updates[key] = body[key] as boolean
  }
  if (!Object.keys(updates).length) {
    return res
      .status(400)
      .json({ message: "No valid feature flags in request body." })
  }

  const flags = await setFeatureFlags(req.scope, updates)
  return res.json({ flags, can_manage: true })
}
