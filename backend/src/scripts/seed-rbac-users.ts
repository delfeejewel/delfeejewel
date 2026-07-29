import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ROLES } from "../lib/rbac"

/**
 * Assigns each RBAC role to its dedicated E2E user, for the admin RBAC suite.
 * Idempotent — re-running just re-asserts the roles.
 *
 * Create the accounts FIRST with the CLI (it handles the auth-identity and
 * password hashing correctly; creating identities by hand collides with
 * authModule.register and leaves accounts that can't log in):
 *
 *   for r in developer admin ops marketing viewer employee; do
 *     npx medusa user -e "e2e-$r@example.com" -p e2elocalpass123
 *   done
 *
 * then:  npx medusa exec ./src/scripts/seed-rbac-users.ts
 *
 * Emails are e2e-<role>@example.com — never a real inbox, per project rule.
 * Roles are written straight to user.metadata.role rather than via
 * POST /admin/set-role, so the suite still has a dependable starting state
 * even when that route is the thing under test.
 */
export default async function seedRbacUsers({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const userModule: any = container.resolve(Modules.USER)

  const missing: string[] = []

  for (const role of ROLES) {
    const email = `e2e-${role}@example.com`
    const existing = await userModule.listUsers({ email })
    const user = existing?.[0]

    if (!user) {
      missing.push(email)
      continue
    }

    await userModule.updateUsers({
      id: user.id,
      metadata: { ...(user.metadata || {}), role },
    })
    logger.info(`${email} -> role=${role}`)
  }

  if (missing.length) {
    logger.warn("")
    logger.warn("These accounts don't exist yet — create them with the CLI:")
    for (const email of missing) {
      logger.warn(`  npx medusa user -e ${email} -p e2elocalpass123`)
    }
  }
}
