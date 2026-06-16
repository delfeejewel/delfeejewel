import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createInventoryItemsWorkflow,
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
  deleteInventoryItemWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Set clean stock for EVERY variant of EVERY product in one pass — the bulk
 * version of set-stock.ts. Use this after adding a batch of products.
 *
 *   npx medusa exec ./src/scripts/set-stock-all.ts <qty>
 *
 *   e.g.  npx medusa exec ./src/scripts/set-stock-all.ts 10
 *
 * Default qty is 10 if you omit it. Same guarantees as set-stock.ts, applied
 * per variant (idempotent — safe to re-run):
 *   - exactly ONE inventory item, linked to the variant
 *   - one inventory level at the stock location, set to <qty>
 *   - any duplicate/empty inventory items removed
 *
 * Runs through the service layer (same path as the admin), so it busts the live
 * inventory cache (unlike raw SQL).
 */
export default async function setStockAll({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const remoteLink = container.resolve(ContainerRegistrationKeys.LINK)

  // ─── Parse qty (only what comes AFTER the script path) ────────────────
  const scriptIdx = process.argv.findIndex((a) =>
    a.endsWith("set-stock-all.ts")
  )
  const argv = scriptIdx >= 0 ? process.argv.slice(scriptIdx + 1) : []
  const qtyArg = argv.find((a) => /^\d+$/.test(a))
  const qty = qtyArg ? parseInt(qtyArg, 10) : 10

  // ─── Resolve the stock location ───────────────────────────────────────
  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const location =
    locations.find((l: any) => l.name === "Chandigarh Store") || locations[0]
  if (!location) {
    logger.error("No stock location found.")
    return
  }
  const locId = location.id

  // ─── Load ALL products + variants + their inventory items/levels ──────
  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "variants.id",
      "variants.sku",
      "variants.title",
      "variants.inventory.id",
      "variants.inventory.sku",
      "variants.inventory.location_levels.location_id",
      "variants.inventory.location_levels.stocked_quantity",
    ],
  })

  if (!products.length) {
    logger.error("No products found.")
    return
  }

  logger.info(
    `🔧 Setting stock to ${qty} @ ${location.name} for ${products.length} ` +
      `product(s)…`
  )

  let productsDone = 0
  let fixed = 0
  let dupesRemoved = 0
  let created = 0

  for (const product of products) {
    const variants = product.variants || []
    if (!variants.length) {
      logger.warn(`  ⚠ "${product.title}" has no variants — skipped.`)
      continue
    }

    for (const variant of variants) {
      try {
        const items: any[] = variant.inventory || []
        let keeper = items.find((it) =>
          (it.location_levels || []).some((l: any) => l.location_id === locId)
        )
        let toDelete: any[]

        if (items.length === 0) {
          // Variant has no linked inventory item. An item with this SKU may
          // already exist but be orphaned (unlinked) — reuse it; else create.
          let item: any
          if (variant.sku) {
            const { data: existing } = await query.graph({
              entity: "inventory_item",
              fields: [
                "id",
                "sku",
                "location_levels.location_id",
                "location_levels.stocked_quantity",
              ],
              filters: { sku: variant.sku },
            })
            item = existing[0]
          }
          if (!item) {
            const { result } = await createInventoryItemsWorkflow(
              container
            ).run({
              input: {
                items: [
                  {
                    sku: variant.sku || undefined,
                    title: `${product.title} — ${variant.title}`,
                  },
                ],
              },
            })
            item = { ...result[0], location_levels: [] }
            logger.info(
              `  • ${product.title} / ${variant.title}: created missing inventory item`
            )
          } else {
            logger.info(
              `  • ${product.title} / ${variant.title}: re-linked existing item (${item.sku})`
            )
          }
          await remoteLink.create([
            {
              [Modules.PRODUCT]: { variant_id: variant.id },
              [Modules.INVENTORY]: { inventory_item_id: item.id },
            },
          ])
          keeper = item
          toDelete = []
          created++
        } else {
          // Keep the item that already has a level here (else the first one).
          keeper = keeper || items[0]
          toDelete = items.filter((it) => it.id !== keeper!.id)
        }

        // Ensure the keeper has a level at this location set to qty.
        const level = (keeper.location_levels || []).find(
          (l: any) => l.location_id === locId
        )
        if (level) {
          await updateInventoryLevelsWorkflow(container).run({
            input: {
              updates: [
                {
                  inventory_item_id: keeper.id,
                  location_id: locId,
                  stocked_quantity: qty,
                },
              ],
            },
          })
        } else {
          await createInventoryLevelsWorkflow(container).run({
            input: {
              inventory_levels: [
                {
                  inventory_item_id: keeper.id,
                  location_id: locId,
                  stocked_quantity: qty,
                },
              ],
            },
          })
        }
        fixed++

        // Remove duplicate/empty inventory items left over from manual entry.
        for (const d of toDelete) {
          await deleteInventoryItemWorkflow(container).run({ input: [d.id] })
          dupesRemoved++
          logger.info(
            `  • ${product.title} / ${variant.title}: removed duplicate inventory item (${d.sku || d.id})`
          )
        }
      } catch (e: any) {
        logger.error(
          `  ✗ ${product.title} / ${variant.title}: ${e?.message || e}`
        )
      }
    }
    productsDone++
  }

  logger.info(
    `✅ Done: ${productsDone} product(s), ${fixed} variant(s) set to ${qty}` +
      (created ? `, ${created} item(s) created/re-linked` : "") +
      (dupesRemoved ? `, ${dupesRemoved} duplicate(s) removed` : "") +
      "."
  )
}
