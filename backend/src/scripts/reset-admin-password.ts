import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function resetAdminPassword({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    // Find all provider identities
    const { data: providerIdentities } = await query.graph({
      entity: "provider_identity",
      fields: ["id", "entity_id", "provider", "auth_identity_id"],
    })

    logger.info(`Provider identities found: ${providerIdentities?.length || 0}`)
    providerIdentities?.forEach((pi: any) => {
      logger.info(`  - ${pi.entity_id} | provider: ${pi.provider} | id: ${pi.id}`)
    })

    // Use the auth module to authenticate and reset
    const authModule = container.resolve(Modules.AUTH)

    // Try to register a new password by calling the authenticate with update
    const result = await (authModule as any).updateProviderIdentities([{
      id: providerIdentities?.[0]?.id,
      provider_data: { password_hash: undefined },
      user_metadata: {},
    }])

    logger.info(`Update result: ${JSON.stringify(result)}`)
  } catch (error: any) {
    logger.error(`Failed: ${error.message}`)
  }
}
