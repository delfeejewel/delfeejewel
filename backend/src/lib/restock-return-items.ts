import { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

/**
 * Restocks the variants associated with a return request's items at the first
 * available stock location. Shared by the refund and exchange flows.
 */
export async function restockReturnItems(
  returnRequestId: string,
  container: MedusaContainer
): Promise<{ restocked: boolean; count: number }> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const inventoryModule: any = container.resolve(Modules.INVENTORY)
  const stockLocationModule: any = container.resolve(Modules.STOCK_LOCATION)

  const locations = await stockLocationModule.listStockLocations({}, { take: 1 })
  const location = locations?.[0]
  if (!location) {
    logger.warn(`Return ${returnRequestId}: no stock location — skipping restock`)
    return { restocked: false, count: 0 }
  }

  const { data: items } = await query.graph({
    entity: "return_request_item",
    filters: { return_request_id: returnRequestId } as any,
    fields: ["id", "variant_id", "quantity"],
  })
  const reqItems = (items as any[]) || []
  const variantIds = reqItems
    .map((i) => i.variant_id)
    .filter(Boolean) as string[]
  if (!variantIds.length) return { restocked: false, count: 0 }

  const { data: variants } = await query.graph({
    entity: "product_variant",
    filters: { id: variantIds },
    fields: ["id", "inventory_items.inventory.id", "inventory_items.id"],
  })

  const variantInv = new Map<string, string[]>()
  for (const v of (variants as any[]) || []) {
    const ids = (v.inventory_items || [])
      .map((ii: any) => ii?.inventory?.id || ii?.id)
      .filter(Boolean)
    variantInv.set(v.id, ids)
  }

  const adjustments: any[] = []
  for (const it of reqItems) {
    const invIds = variantInv.get(it.variant_id) || []
    // Adjust ONLY the canonical (first) inventory item. A variant can carry
    // duplicate inventory items in this project (known gotcha); restocking all
    // of them would multiply the returned quantity back into stock.
    const inventoryItemId = invIds[0]
    if (!inventoryItemId) continue
    adjustments.push({
      inventoryItemId,
      locationId: location.id,
      adjustment: Number(it.quantity || 0),
    })
  }
  if (!adjustments.length) return { restocked: false, count: 0 }

  await inventoryModule.adjustInventory(adjustments)
  logger.info(
    `Return ${returnRequestId}: restocked ${adjustments.length} inventory entry(ies)`
  )
  return { restocked: true, count: adjustments.length }
}
