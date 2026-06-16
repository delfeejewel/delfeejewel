import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateInventoryItemsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Change an inventory item's SKU.
 *   npx medusa exec ./src/scripts/set-inventory-sku.ts <current-sku> <new-sku>
 */
export default async function setInventorySku({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const i = process.argv.findIndex((a) => a.endsWith("set-inventory-sku.ts"))
  const args = i >= 0 ? process.argv.slice(i + 1) : []
  const [currentSku, newSku] = args
  if (!currentSku || !newSku) {
    logger.error("Usage: … set-inventory-sku.ts <current-sku> <new-sku>")
    return
  }

  const { data: items } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku", "title"],
    filters: { sku: currentSku },
  })
  if (!items.length) {
    logger.error(`No inventory item with sku "${currentSku}".`)
    return
  }

  await updateInventoryItemsWorkflow(container).run({
    input: { updates: [{ id: items[0].id, sku: newSku }] },
  })
  logger.info(`✅ SKU: "${currentSku}" → "${newSku}" (${items[0].title}).`)
}
