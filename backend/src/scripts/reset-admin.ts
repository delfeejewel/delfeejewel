import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const EMAIL = "admin@delfee.local"
const PASSWORD = "Admin@12345"

/**
 * Creates an admin user with known credentials for local testing.
 * Idempotent — if already exists, just logs the creds.
 *
 * Run with: npx medusa exec ./src/scripts/reset-admin.ts
 */
export default async function resetAdmin({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const authModule: any = container.resolve(Modules.AUTH)
  const userModule: any = container.resolve(Modules.USER)

  try {
    const existing = await userModule.listUsers({ email: EMAIL })
    if (existing?.length) {
      logger.info(`Admin already exists: ${EMAIL}`)
    } else {
      const { success, authIdentity, error } = await authModule.register(
        "emailpass",
        { body: { email: EMAIL, password: PASSWORD } }
      )
      if (!success || !authIdentity) {
        logger.error(`auth register failed: ${error}`)
        return
      }
      const [user] = await userModule.createUsers([
        { email: EMAIL, first_name: "Admin", last_name: "Local" },
      ])
      await authModule.updateAuthIdentities([
        { id: authIdentity.id, app_metadata: { user_id: user.id } },
      ])
      logger.info(`Created admin: ${EMAIL}`)
    }
    logger.info("──────────────────────────────────────────────")
    logger.info(`Email:    ${EMAIL}`)
    logger.info(`Password: ${PASSWORD}`)
    logger.info("──────────────────────────────────────────────")
  } catch (e: any) {
    logger.error(`Failed: ${e.message}`)
  }
}
