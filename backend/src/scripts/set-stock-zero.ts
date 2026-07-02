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
 * Set stock to <qty> ONLY for variants that are currently empty (no inventory
 * level, or stocked_quantity === 0). Non-destructive: variants already carrying
 * a positive quantity are left exactly as the admin set them. Use this right
 * after adding a batch of new products.
 *
 *   npx medusa exec ./src/scripts/set-stock-zero.ts <qty>   (default 10)
 *
 * Same per-variant guarantees as set-stock.ts (idempotent, service-layer so it
 * busts the live inventory cache): exactly one inventory item linked, one level
 * at the stock location, duplicate/empty items removed.
 */
export default async function setStockZero({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const remoteLink = container.resolve(ContainerRegistrationKeys.LINK)

  const scriptIdx = process.argv.findIndex((a) =>
    a.endsWith("set-stock-zero.ts")
  )
  const argv = scriptIdx >= 0 ? process.argv.slice(scriptIdx + 1) : []
  const qtyArg = argv.find((a) => /^\d+$/.test(a))
  const qty = qtyArg ? parseInt(qtyArg, 10) : 10

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

  const all: any[] = []
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
    all.push(...page)
    if (page.length < limit) break
    offset += limit
  }

  let touched = 0
  let created = 0
  let dupesRemoved = 0
  const handlesTouched = new Set<string>()

  for (const product of all) {
    for (const variant of product.variants || []) {
      const items: any[] = variant.inventory || []
      // Current qty at this location across all linked items.
      let curr: number | null = null
      for (const it of items) {
        for (const l of it.location_levels || []) {
          if (l.location_id === locId) curr = (curr || 0) + l.stocked_quantity
        }
      }
      // Skip variants that already have positive stock — don't clobber them.
      if (curr !== null && curr > 0) continue

      try {
        let keeper = items.find((it) =>
          (it.location_levels || []).some((l: any) => l.location_id === locId)
        )
        let toDelete: any[]

        if (items.length === 0) {
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
          keeper = keeper || items[0]
          toDelete = items.filter((it) => it.id !== keeper!.id)
        }

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
        touched++
        handlesTouched.add(product.handle)

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
  }

  logger.info(
    `✅ Set ${touched} empty variant(s) to ${qty} across ${handlesTouched.size} product(s)` +
      (created ? `, ${created} item(s) created/re-linked` : "") +
      (dupesRemoved ? `, ${dupesRemoved} duplicate(s) removed` : "") +
      "."
  )
  if (handlesTouched.size) {
    logger.info(`   Touched: ${[...handlesTouched].join(", ")}`)
  }
}
