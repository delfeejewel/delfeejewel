import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { getUserRole } from "../../../lib/rbac"
import {
  getProductsPinHash,
  setProductsPinHash,
  hashPin,
} from "../../../lib/products-pin"

/**
 * GET /admin/products-pin — whether a shared employee Products PIN is set,
 * and whether the caller may manage it.
 * POST /admin/products-pin — set (or clear) the PIN. HANDLER-level developer
 * guard (custom RBAC middleware fails open on some phases, so it lives here).
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
  const [hash, canManage] = await Promise.all([
    getProductsPinHash(req.scope),
    isDeveloper(req),
  ])
  return res.json({ has_pin: !!hash, can_manage: canManage })
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

  if (body.clear === true) {
    await setProductsPinHash(req.scope, null)
    return res.json({ has_pin: false, can_manage: true })
  }

  const pin = String(body.pin || "")
  if (!/^\d{4}$/.test(pin)) {
    return res.status(400).json({ message: "PIN must be exactly 4 digits." })
  }

  await setProductsPinHash(req.scope, hashPin(pin))
  return res.json({ has_pin: true, can_manage: true })
}
