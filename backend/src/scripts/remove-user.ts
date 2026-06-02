import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function removeUser({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const userModule = container.resolve(Modules.USER)
  const authModule = container.resolve(Modules.AUTH)

  const email = "deepanshu@yopmail.com"

  try {
    // Find user
    const users = await userModule.listUsers({ email })
    if (!users.length) {
      logger.info(`User ${email} not found`)
      return
    }

    const user = users[0]
    logger.info(`Found user: ${user.id} (${email})`)

    // Delete user
    await userModule.deleteUsers([user.id])
    logger.info(`Deleted user: ${email}`)

    // Delete auth identity
    const identities = await authModule.listAuthIdentities()
    for (const identity of identities) {
      const providers = (identity as any).provider_identities || []
      if (providers.some((p: any) => p.entity_id === email)) {
        await authModule.deleteAuthIdentities([identity.id])
        logger.info(`Deleted auth identity: ${identity.id}`)
      }
    }

    logger.info("Done")
  } catch (error: any) {
    logger.error(`Failed: ${error.message}`)
  }
}
