import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * On variant creation:
 * 1. Auto-enables inventory management
 * 2. Creates inventory item
 * 3. Links to default stock location with 0 stock
 */
export default async function variantCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const variantId = data.id

  // 1. Enable inventory management
  try {
    const productModule = container.resolve(Modules.PRODUCT)
    await productModule.updateProductVariants(variantId, {
      manage_inventory: true,
    })
  } catch (error: any) {
    logger.warn(`Enable inventory failed: ${error.message}`)
    return
  }

  // 2. Create inventory item + link to stock location
  try {
    const inventoryModule = container.resolve(Modules.INVENTORY)
    const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)
    const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK)

    // Get default stock location
    const [location] = await stockLocationModule.listStockLocations({}, { take: 1 })
    if (!location) {
      logger.warn("No stock location found")
      return
    }

    // Get variant details for a readable title/SKU
    const productModule = container.resolve(Modules.PRODUCT)
    const variant = await productModule.retrieveProductVariant(variantId, {
      relations: ["product"],
    }) as any
    const variantTitle = variant?.title || variantId
    const productTitle = variant?.product?.title || ""
    const itemTitle = productTitle ? `${productTitle} — ${variantTitle}` : variantTitle

    // Create inventory item
    const [inventoryItem] = await inventoryModule.createInventoryItems([{
      title: itemTitle,
      sku: variantId,
      requires_shipping: true,
    }])

    // Link variant to inventory item
    await remoteLink.create([
      {
        [Modules.PRODUCT]: { variant_id: variantId },
        [Modules.INVENTORY]: { inventory_item_id: inventoryItem.id },
      },
    ] as any)

    // Set stock level at location. New variants start at a usable default so a
    // freshly created product is immediately sellable — the store runs a single
    // location, so there is no allocation decision to make here. Override with
    // DEFAULT_NEW_VARIANT_STOCK; staff can adjust per-variant from the product
    // page's "Stock" card afterwards.
    const defaultStock = Number(process.env.DEFAULT_NEW_VARIANT_STOCK ?? 10)
    await inventoryModule.createInventoryLevels([{
      inventory_item_id: inventoryItem.id,
      location_id: location.id,
      stocked_quantity: Number.isFinite(defaultStock) ? defaultStock : 10,
    }])

    logger.info(`Variant ${variantId} → inventory item ${inventoryItem.id} → ${location.name} (${defaultStock} stock)`)
  } catch (error: any) {
    if (!error.message?.includes("already exists") && !error.message?.includes("duplicate")) {
      logger.warn(`Inventory setup failed: ${error.message}`)
    }
  }
}

export const config: SubscriberConfig = {
  event: "product-variant.created",
}
