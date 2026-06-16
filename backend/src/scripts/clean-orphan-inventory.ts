import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deleteInventoryItemWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Delete orphaned inventory items — items that are linked to NO product
 * variant. These can never be sold and just clutter the admin Inventory list
 * (they're typically left behind by manual product-entry mistakes).
 *
 *   npx medusa exec ./src/scripts/clean-orphan-inventory.ts          # dry run (lists only)
 *   npx medusa exec ./src/scripts/clean-orphan-inventory.ts apply    # actually delete
 *
 * Service layer → busts the live cache. Idempotent.
 */
export default async function cleanOrphanInventory({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const apply = process.argv.includes("apply")

  const { data: items } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku", "title", "variants.id"],
  })

  const orphans = items.filter((i: any) => !(i.variants || []).length)

  if (!orphans.length) {
    logger.info("✅ No orphaned inventory items. Nothing to clean.")
    return
  }

  logger.info(
    `${apply ? "Deleting" : "Found (dry run)"} ${orphans.length} orphaned inventory item(s):`
  )
  for (const o of orphans) {
    logger.info(`  • ${o.title || "(untitled)"}  [sku: ${o.sku || "—"}]`)
  }

  if (!apply) {
    logger.info("Re-run with `apply` to delete them.")
    return
  }

  for (const o of orphans) {
    await deleteInventoryItemWorkflow(container).run({ input: [o.id] })
  }
  logger.info(`✅ Deleted ${orphans.length} orphaned inventory item(s).`)
}
