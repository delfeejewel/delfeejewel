import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Read-only audit: confirm EVERY variant of EVERY product has stock == 10 at
 * exactly ONE location, with exactly ONE inventory item (no dup-item bug).
 *
 * Flags:
 *   MISSING   — no inventory item / no location level
 *   QTY       — total stocked qty != 10
 *   MULTI_LOC — level present at more than one location
 *   DUP_ITEM  — variant linked to >1 inventory item
 *
 *   npx medusa exec ./src/scripts/verify-stock-10.ts
 */
export default async function verifyStock10({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  logger.info(
    `Locations (${locations.length}): ${locations
      .map((l: any) => `${l.name}`)
      .join(", ")}`
  )

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

  let variantCount = 0
  const problems: string[] = []

  for (const p of all) {
    for (const v of p.variants || []) {
      variantCount++
      const items = v.inventory || []
      const flags: string[] = []

      if (items.length === 0) flags.push("MISSING(no-item)")
      if (items.length > 1) flags.push(`DUP_ITEM(${items.length})`)

      const locSet = new Set<string>()
      let total = 0
      let anyLevel = false
      for (const it of items) {
        for (const l of it.location_levels || []) {
          anyLevel = true
          locSet.add(l.location_id)
          total += l.stocked_quantity
        }
      }
      if (items.length && !anyLevel) flags.push("MISSING(no-level)")
      if (locSet.size > 1) flags.push(`MULTI_LOC(${locSet.size})`)
      if (anyLevel && total !== 10) flags.push(`QTY(${total})`)

      if (flags.length) {
        problems.push(
          `⚠️  ${p.handle} :: ${v.title} (${v.sku || "no-sku"}) — ${flags.join(", ")}`
        )
      }
    }
  }

  logger.info(`\n📦 ${all.length} products, ${variantCount} variants checked.`)
  if (!problems.length) {
    logger.info(`✅ ALL variants have exactly 10 stock at one location. Clean.`)
  } else {
    logger.info(`❌ ${problems.length} variant(s) with issues:\n`)
    for (const line of problems) logger.info(line)
  }
}
