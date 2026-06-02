import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

import { ROLES, type Role } from "../../../lib/rbac"

/**
 * POST /admin/set-role
 * Assigns a role to a user via their metadata.
 *
 * Body: { user_id: string, role: "developer" | "admin" }
 *
 * Only developers can assign roles.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const userModule = req.scope.resolve(Modules.USER)

  // Verify the caller is a developer
  const callers = await userModule.listUsers({ id: actorId })
  const caller = callers?.[0] as any

  if (caller?.metadata?.role !== "developer") {
    return res.status(403).json({
      message: "Only developers can assign roles.",
    })
  }

  const { user_id, role } = req.body as { user_id: string; role: string }

  if (!user_id || !role) {
    return res.status(400).json({ message: "user_id and role are required" })
  }

  if (!ROLES.includes(role as Role)) {
    return res
      .status(400)
      .json({ message: `Role must be one of: ${ROLES.join(", ")}` })
  }

  // Update target user's metadata
  const [updatedUser] = await userModule.updateUsers([{
    id: user_id,
    metadata: { role },
  }])

  return res.json({
    message: `Role '${role}' assigned to user ${user_id}`,
    user: updatedUser,
  })
}

/**
 * GET /admin/set-role
 * Lists all users with their roles. Only developers can view.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const userModule = req.scope.resolve(Modules.USER)

  // Verify the caller is a developer
  const callers = await userModule.listUsers({ id: actorId })
  const caller = callers?.[0] as any

  if (caller?.metadata?.role !== "developer") {
    return res.status(403).json({
      message: "Only developers can view role assignments.",
    })
  }

  // List all users with their roles
  const users = await userModule.listUsers()

  const usersWithRoles = (users || []).map((u: any) => ({
    id: u.id,
    email: u.email,
    name: [u.first_name, u.last_name].filter(Boolean).join(" ") || null,
    role: u.metadata?.role || "admin",
  }))

  return res.json({ users: usersWithRoles })
}
