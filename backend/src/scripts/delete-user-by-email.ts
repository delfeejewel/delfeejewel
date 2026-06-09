import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Deletes an admin user (and its auth identity / login) by email.
 *
 * Run with env var DELETE_EMAIL, e.g.:
 *   DELETE_EMAIL=old@delfee.in npx medusa exec ./src/scripts/delete-user-by-email.ts
 *
 * Safety: refuses to delete the last remaining user.
 */
export default async function deleteUserByEmail({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const userModule = container.resolve(Modules.USER)
  const authModule = container.resolve(Modules.AUTH)

  const email = process.env.DELETE_EMAIL?.trim().toLowerCase()
  if (!email) {
    logger.error("Set DELETE_EMAIL env var.")
    return
  }

  const all = await userModule.listUsers()
  if ((all?.length || 0) <= 1) {
    logger.error("Refusing to delete the last remaining admin user.")
    return
  }

  const users = await userModule.listUsers({ email })
  const user = users?.[0] as any
  if (!user) {
    logger.info(`User ${email} not found`)
    return
  }

  await userModule.deleteUsers([user.id])
  logger.info(`Deleted user: ${email}`)

  // Remove the matching auth identity so the login can't be reused.
  const identities = await authModule.listAuthIdentities()
  for (const identity of identities) {
    const providers = (identity as any).provider_identities || []
    if (providers.some((p: any) => p.entity_id === email)) {
      await authModule.deleteAuthIdentities([identity.id])
      logger.info(`Deleted auth identity: ${identity.id}`)
    }
  }

  logger.info("Done")
}
