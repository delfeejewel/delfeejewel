import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { ROLES, type Role } from "../lib/rbac"

/**
 * Assigns an RBAC role to a specific user (by email).
 *
 * Run with env vars ROLE_EMAIL + ROLE_NAME, e.g.:
 *   ROLE_EMAIL=dev@delfee.in ROLE_NAME=developer \
 *     npx medusa exec ./src/scripts/set-user-role.ts
 *
 * Valid roles: developer | admin | ops | marketing | viewer  (see lib/rbac.ts)
 */
export default async function setUserRole({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const userModule = container.resolve(Modules.USER)

  const email = process.env.ROLE_EMAIL?.trim().toLowerCase()
  const role = process.env.ROLE_NAME?.trim() as Role | undefined

  if (!email || !role) {
    logger.error("Set ROLE_EMAIL and ROLE_NAME env vars.")
    return
  }
  if (!ROLES.includes(role)) {
    logger.error(`Invalid role "${role}". Valid: ${ROLES.join(", ")}`)
    return
  }

  const users = await userModule.listUsers({ email })
  const user = users?.[0] as any
  if (!user) {
    logger.error(`No user found with email ${email}`)
    return
  }

  await userModule.updateUsers([
    { id: user.id, metadata: { ...(user.metadata || {}), role } },
  ])
  logger.info(`✓ ${email} → ${role}`)
}
