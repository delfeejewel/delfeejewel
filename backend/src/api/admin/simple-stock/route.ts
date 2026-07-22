import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Simple single-location stock read/write for the admin "Stock" card.
 *
 * The store runs exactly one stock location, so Medusa's native
 * variant → inventory item → location-level drill-down is pure friction for
 * staff. This exposes the only thing that actually matters: a number per
 * variant.
 *
 *   GET  /admin/simple-stock?product_id=prod_123
 *        -> { location, variants: [{ variant_id, title, sku, quantity }] }
 *   POST /admin/simple-stock  { variant_id, quantity }
 *        -> { variant_id, quantity }
 *
 * Guards against the duplicate-inventory-item problem this catalogue has hit
 * before (a variant ending up with two inventory items, the storefront reading
 * the empty one): we always resolve the item that is actually LINKED to the
 * variant, and write the level there.
 */

async function resolveLocationId(container: any): Promise<string | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  if (!locations?.length) return null
  const preferred =
    (locations as any[]).find((l) => l.name === "Chandigarh Store") ||
    locations[0]
  return preferred.id
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const productId = String(req.query.product_id || "")
  if (!productId) {
    return res.status(400).json({ message: "product_id is required" })
  }

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const location =
    (locations as any[])?.find((l) => l.name === "Chandigarh Store") ||
    (locations as any[])?.[0]

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.manage_inventory",
      "variants.inventory.id",
      "variants.inventory.location_levels.location_id",
      "variants.inventory.location_levels.stocked_quantity",
      "variants.inventory.location_levels.reserved_quantity",
    ],
    filters: { id: productId } as any,
  })

  const product = (products as any[])?.[0]
  if (!product) return res.status(404).json({ message: "Product not found" })

  const variants = ((product.variants as any[]) || []).map((v) => {
    // A variant can have more than one inventory item if data got messy; the
    // linked ones are what Medusa actually reserves against, so sum those.
    const totals = ((v.inventory as any[]) || []).reduce(
      (acc, item) => {
        const level = ((item?.location_levels as any[]) || []).find(
          (l) => l.location_id === location?.id
        )
        acc.stocked += Number(level?.stocked_quantity) || 0
        acc.reserved += Number(level?.reserved_quantity) || 0
        return acc
      },
      { stocked: 0, reserved: 0 }
    )
    return {
      variant_id: v.id,
      title: v.title,
      sku: v.sku,
      manage_inventory: v.manage_inventory,
      // `quantity` is the physical count staff edit (stocked_quantity).
      quantity: totals.stocked,
      // Medusa reserves at order time and only decrements stocked on
      // fulfilment, so surface both — otherwise stock looks unchanged right
      // after an order comes in.
      reserved: totals.reserved,
      available: totals.stocked - totals.reserved,
    }
  })

  return res.json({
    location: location ? { id: location.id, name: location.name } : null,
    variants,
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const container = req.scope
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { variant_id, quantity } = (req.body ?? {}) as {
    variant_id?: string
    quantity?: number
  }

  const qty = Number(quantity)
  if (!variant_id || !Number.isFinite(qty) || qty < 0) {
    return res
      .status(400)
      .json({ message: "variant_id and a quantity >= 0 are required" })
  }

  const locationId = await resolveLocationId(container)
  if (!locationId) {
    return res.status(400).json({ message: "No stock location configured" })
  }

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "inventory.id",
      "inventory.location_levels.id",
      "inventory.location_levels.location_id",
    ],
    filters: { id: variant_id } as any,
  })

  const variant = (variants as any[])?.[0]
  const items = (variant?.inventory as any[]) || []
  if (!items.length) {
    return res
      .status(400)
      .json({ message: "This variant has no inventory item linked" })
  }

  // Write the full quantity to the first linked item and zero any extras, so a
  // variant that picked up duplicate items reports the intended number rather
  // than a doubled or split total.
  const [primary, ...extras] = items
  try {
    for (const [idx, item] of [primary, ...extras].entries()) {
      const target = idx === 0 ? qty : 0
      const level = ((item.location_levels as any[]) || []).find(
        (l) => l.location_id === locationId
      )
      if (level) {
        await updateInventoryLevelsWorkflow(container).run({
          input: {
            updates: [
              {
                inventory_item_id: item.id,
                location_id: locationId,
                stocked_quantity: target,
              },
            ],
          },
        })
      } else if (idx === 0) {
        await createInventoryLevelsWorkflow(container).run({
          input: {
            inventory_levels: [
              {
                inventory_item_id: item.id,
                location_id: locationId,
                stocked_quantity: target,
              },
            ],
          },
        })
      }
    }
  } catch (e: any) {
    logger.error(`simple-stock update failed for ${variant_id}: ${e.message}`)
    return res.status(500).json({ message: e.message || "Failed to set stock" })
  }

  return res.json({ variant_id, quantity: qty })
}
