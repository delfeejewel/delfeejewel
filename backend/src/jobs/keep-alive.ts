import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function keepAliveJob(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    await query.graph({ entity: "store", fields: ["id"] })
    logger.info("Keep-alive: database ping successful")
  } catch (error) {
    logger.error("Keep-alive: database ping failed", error)
  }
}

export const config = {
  name: "keep-alive",
  schedule: "0 */6 * * *", // every 6 hours
}
