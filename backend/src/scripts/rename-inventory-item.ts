import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateInventoryItemsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Rename an inventory item by SKU (cosmetic — the admin Inventory list title).
 *   npx medusa exec ./src/scripts/rename-inventory-item.ts <sku> "<new title>"
 */
export default async function renameInventoryItem({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const i = process.argv.findIndex((a) => a.endsWith("rename-inventory-item.ts"))
  const args = i >= 0 ? process.argv.slice(i + 1) : []
  const sku = args[0]
  const newTitle = args.slice(1).join(" ")
  if (!sku || !newTitle) {
    logger.error('Usage: … rename-inventory-item.ts <sku> "<new title>"')
    return
  }

  const { data: items } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku", "title"],
    filters: { sku },
  })
  if (!items.length) {
    logger.error(`No inventory item with sku "${sku}".`)
    return
  }

  await updateInventoryItemsWorkflow(container).run({
    input: { updates: [{ id: items[0].id, title: newTitle }] },
  })
  logger.info(`✅ Renamed "${items[0].title}" → "${newTitle}" (sku ${sku}).`)
}
