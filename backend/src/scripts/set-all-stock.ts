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
 * Set clean stock for EVERY variant of EVERY product — catalogue-wide.
 *
 *   npx medusa exec ./src/scripts/set-all-stock.ts <qty>
 *   e.g.  npx medusa exec ./src/scripts/set-all-stock.ts 10   (default 10)
 *
 * Same per-variant guarantees as set-stock.ts (idempotent, safe to re-run):
 *   - exactly ONE inventory item, linked to the variant
 *   - one inventory level at the single stock location, set to <qty>
 *   - any duplicate/empty inventory items removed
 *
 * Runs through the service layer (same path as the admin), so it busts the
 * live inventory cache (unlike raw SQL).
 */
export default async function setAllStock({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const remoteLink = container.resolve(ContainerRegistrationKeys.LINK)

  // ─── Parse qty (only what comes AFTER the script path) ────────────────
  const scriptIdx = process.argv.findIndex((a) =>
    a.endsWith("set-all-stock.ts")
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
  const allProducts: any[] = []
  const limit = 100
  let offset = 0
  for (;;) {
    const { data: page } = await query.graph({
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
      pagination: { skip: offset, take: limit },
    })
    if (!page.length) break
    allProducts.push(...page)
    if (page.length < limit) break
    offset += limit
  }

  logger.info(
    `🔧 Setting stock to ${qty} @ ${location.name} for ${allProducts.length} product(s)…`
  )

  let productsDone = 0
  let fixed = 0
  let dupesRemoved = 0
  let created = 0

  for (const product of allProducts) {
    for (const variant of product.variants || []) {
      try {
        const items: any[] = variant.inventory || []
        let keeper = items.find((it) =>
          (it.location_levels || []).some(
            (l: any) => l.location_id === locId
          )
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
        }
      } catch (e: any) {
        logger.error(
          `  ✗ ${product.title} / ${variant.title}: ${e?.message || e}`
        )
      }
    }
    productsDone++
    if (productsDone % 25 === 0) {
      logger.info(`  …${productsDone}/${allProducts.length} products done`)
    }
  }

  logger.info(
    `✅ Done: ${productsDone} product(s), ${fixed} variant(s) set to ${qty}` +
      (created ? `, ${created} item(s) created/re-linked` : "") +
      (dupesRemoved ? `, ${dupesRemoved} duplicate(s) removed` : "") +
      "."
  )
}
