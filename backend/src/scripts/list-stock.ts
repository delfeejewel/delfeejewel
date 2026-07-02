import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Read-only: print every product, its variants, and the stocked quantity at
 * the stock location. Use to see which freshly-added products still need stock.
 *
 *   npx medusa exec ./src/scripts/list-stock.ts
 */
export default async function listStock({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const location =
    locations.find((l: any) => l.name === "Chandigarh Store") || locations[0]
  const locId = location?.id

  const all: any[] = []
  const limit = 100
  let offset = 0
  for (;;) {
    const { data: page } = await query.graph({
      entity: "product",
      fields: [
        "title",
        "handle",
        "variants.id",
        "variants.title",
        "variants.sku",
        "variants.inventory.id",
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

  logger.info(`📦 ${all.length} product(s) @ ${location?.name}:`)
  for (const p of all) {
    const parts: string[] = []
    let zero = false
    for (const v of p.variants || []) {
      const items = v.inventory || []
      let qty: number | null = null
      for (const it of items) {
        for (const l of it.location_levels || []) {
          if (l.location_id === locId) qty = (qty || 0) + l.stocked_quantity
        }
      }
      if (qty === null || qty === 0) zero = true
      parts.push(`${v.title}=${qty === null ? "—" : qty}`)
    }
    logger.info(
      `${zero ? "⚠️ " : "   "}${p.handle}  [${parts.join(", ")}]`
    )
  }
}
