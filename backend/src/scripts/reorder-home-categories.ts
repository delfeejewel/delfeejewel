import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Set top-level product_category.rank so the homepage category row
 * (CategoryGrid, which renders /store/product-categories in its returned
 * order — no client-side sort) shows:
 *   Rakhi, Rings, Bracelets, Pendants, Necklace, Earrings, Mangalsutras,
 *   Anklets, then any other top-level categories after (unchanged relative
 *   order among themselves).
 *
 * Usage (DRY RUN by default):
 *   npx medusa exec ./src/scripts/reorder-home-categories.ts
 *   npx medusa exec ./src/scripts/reorder-home-categories.ts apply
 */
const DESIRED_ORDER = [
  "rakhi",
  "rings",
  "bracelets",
  "pendants",
  "necklace",
  "earrings",
  "mangalsutras",
  "anklets",
]

export default async function run({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const apply = args.includes("apply")

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle", "rank", "parent_category_id"],
  })
  const topLevel = (categories as any[])
    .filter((c) => !c.parent_category_id)
    .sort((a, b) => a.rank - b.rank)

  const named = DESIRED_ORDER
    .map((h) => topLevel.find((c) => c.handle === h))
    .filter(Boolean) as any[]
  const missing = DESIRED_ORDER.filter((h) => !topLevel.some((c) => c.handle === h))
  const rest = topLevel.filter((c) => !DESIRED_ORDER.includes(c.handle))

  const finalOrder = [...named, ...rest]

  logger.info(
    `${apply ? "APPLYING" : "DRY RUN (pass \`apply\` to write)"} — new homepage order:`
  )
  finalOrder.forEach((c, i) => {
    logger.info(`  ${i}: ${c.name} (${c.handle}) — rank ${c.rank} → ${i}`)
  })
  if (missing.length) {
    logger.warn(`Not found, skipped: ${missing.join(", ")}`)
  }

  if (apply) {
    for (let i = 0; i < finalOrder.length; i++) {
      const c = finalOrder[i]
      if (c.rank === i) continue
      await updateProductCategoriesWorkflow(container).run({
        input: { selector: { id: c.id }, update: { rank: i } } as any,
      })
    }
    logger.info("Done.")
  }
}
