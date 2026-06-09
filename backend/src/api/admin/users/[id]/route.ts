import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { removeUserAccountWorkflow } from "@medusajs/core-flows"

import { getUserRole } from "../../../../lib/rbac"

/**
 * Override of core DELETE /admin/users/:id — hard-guards user deletion to the
 * `developer` role.
 *
 * We enforce this in the route handler (which only runs AFTER admin auth, so
 * req.auth_context.actor_id is always present) rather than via the RBAC
 * middleware, because the middleware was not reliably gating this core route
 * (a missing actor_id in the middleware phase made the check pass through).
 *
 * Behaviour otherwise mirrors core: can't delete yourself; runs the same
 * removeUserAccountWorkflow; same response shape. GET/POST for this path are
 * left to the core handlers (we only override DELETE).
 */
export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params
  const actorId = req.auth_context?.actor_id

  const role = await getUserRole(req.scope as any, actorId)
  if (role !== "developer") {
    return res.status(403).json({
      message: "Access denied. Only developers can delete users.",
    })
  }

  if (actorId === id) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "A user cannot delete itself"
    )
  }

  await removeUserAccountWorkflow(req.scope).run({ input: { userId: id } })

  return res.status(200).json({ id, object: "user", deleted: true })
}
