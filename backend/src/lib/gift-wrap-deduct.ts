import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows"

/** SKU of the gift-wrap service variant; wrapper stock lives on this item. */
const GIFT_WRAP_SKU = "GIFT-WRAP-INR-50"

/**
 * Deducts `count` gift wrappers from the single-location inventory item.
 * Looked up as a standalone inventory item, NOT through the product: the
 * gift-wrap variant has manage_inventory off (so Medusa never deducts a
 * wrapper itself and double-counts the packer's entry), which removes the
 * variant→inventory link but leaves the item and its level.
 *
 * Returns the resulting stock level, or null if the item/level couldn't be
 * found or the update failed (caller decides whether/how to surface that —
 * a stock failure must never lose the packer's recorded count).
 */
export async function deductGiftWrapStock(
  scope: any,
  count: number
): Promise<number | null> {
  if (count <= 0) return null
  try {
    const query = scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: items } = await query.graph({
      entity: "inventory_item",
      fields: ["id", "location_levels.location_id", "location_levels.stocked_quantity"],
      filters: { sku: GIFT_WRAP_SKU } as any,
    })
    const item = (items as any[])[0]
    const level = (item?.location_levels || [])[0]
    if (!item || !level) return null

    const next = Math.max(0, Number(level.stocked_quantity || 0) - count)
    await updateInventoryLevelsWorkflow(scope).run({
      input: {
        updates: [
          {
            inventory_item_id: item.id,
            location_id: level.location_id,
            stocked_quantity: next,
          },
        ],
      },
    })
    return next
  } catch {
    return null
  }
}
