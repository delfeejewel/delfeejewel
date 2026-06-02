import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { checkLowStock } from "../lib/check-low-stock"

/**
 * Daily low-stock sweep — sends the admin a digest of every variant at or
 * below the configured threshold. Schedule via cron, threshold via env.
 */
export default async function lowStockAlertJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const { low, emailed_to } = await checkLowStock(container, {})
    logger.info(
      `Low-stock job: ${low.length} low item(s); emailed=${emailed_to || "none"}`
    )
  } catch (e: any) {
    logger.error(`Low-stock job failed: ${e?.message}`)
  }
}

export const config = {
  name: "low-stock-alert",
  schedule: "0 9 * * *", // every day at 9 AM
}
