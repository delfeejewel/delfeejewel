import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createProductTypesWorkflow,
  createProductTagsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Register the "Bracelet" product type and every tag used by the bracelet
 * products in Products/products-data.md (Prod-23 … Prod-35).
 *
 *   npx medusa exec ./src/scripts/register-bracelet-type-tags.ts
 *
 * Idempotent: only the type/tags that don't already exist are created, so
 * existing ring tags are left untouched and re-running is safe.
 */

// The product type to register.
const TYPE_VALUE = "Bracelet"

// Union of all tags across the bracelet entries in products-data.md.
const BRACELET_TAGS = [
  "silver",
  "bracelet",
  "halo",
  "station",
  "oval",
  "pink",
  "black",
  "colour",
  "cz",
  "emerald-cut",
  "multicolour",
  "marquise",
  "heart",
  "baguette",
  "tennis",
  "line",
  "statement",
  "bezel",
  "love",
  "everyday",
  "hexagon",
  "pave",
  "geometric",
  "clover",
  "quatrefoil",
  "onyx",
  "mother-of-pearl",
  "dainty",
  "link",
  "cluster",
  "bead",
  "butterfly",
  "round",
  "premium",
  "minimalist",
  "classic",
  "timeless",
]

export default async function registerBraceletTypeTags({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // ─── Product type ─────────────────────────────────────────────────────
  const { data: existingTypes } = await query.graph({
    entity: "product_type",
    fields: ["id", "value"],
    filters: { value: TYPE_VALUE },
  })

  if (existingTypes.length) {
    logger.info(`• Type "${TYPE_VALUE}" already exists — skipped.`)
  } else {
    await createProductTypesWorkflow(container).run({
      input: { product_types: [{ value: TYPE_VALUE }] },
    })
    logger.info(`✅ Created product type "${TYPE_VALUE}".`)
  }

  // ─── Tags (create only the missing ones) ──────────────────────────────
  const { data: existingTags } = await query.graph({
    entity: "product_tag",
    fields: ["id", "value"],
  })
  const existingSet = new Set(existingTags.map((t: any) => t.value))

  const toCreate = BRACELET_TAGS.filter((t) => !existingSet.has(t))

  if (!toCreate.length) {
    logger.info("• All bracelet tags already exist — nothing to create.")
  } else {
    await createProductTagsWorkflow(container).run({
      input: { product_tags: toCreate.map((value) => ({ value })) },
    })
    logger.info(
      `✅ Created ${toCreate.length} new tag(s): ${toCreate.join(", ")}`
    )
  }

  const skipped = BRACELET_TAGS.length - toCreate.length
  logger.info(
    `Done: type "${TYPE_VALUE}" ensured, ${toCreate.length} tag(s) created, ` +
      `${skipped} already present.`
  )
}
