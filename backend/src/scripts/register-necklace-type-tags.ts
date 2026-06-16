import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createProductTypesWorkflow,
  createProductTagsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Register the "Necklace" product type and every tag used by the necklace
 * products in Products/products-data.md (Prod-36 … Prod-43).
 *
 *   npx medusa exec ./src/scripts/register-necklace-type-tags.ts
 *
 * Idempotent: only the type/tags that don't already exist are created, so the
 * existing ring/bracelet tags are left untouched and re-running is safe.
 */

// The product type to register.
const TYPE_VALUE = "Necklace"

// Union of all tags across the necklace entries in products-data.md.
const NECKLACE_TAGS = [
  "silver",
  "necklace",
  "crystal",
  "beaded",
  "green",
  "peridot",
  "flower",
  "floral",
  "pink",
  "rose",
  "cluster",
  "butterfly",
  "clear",
  "red",
  "ruby",
  "pendant",
  "charm",
  "drop",
  "marquise",
  "amethyst",
  "purple",
  "cz",
  "boho",
  "statement",
  "station",
  "square",
  "geometric",
  "openwork",
  "minimalist",
  "star",
  "celestial",
  "dainty",
  "everyday",
  // Statement / bridal sets (Prod-44 … Prod-48)
  "set",
  "earrings",
  "bridal",
  "oxidized",
  "temple",
  "ethnic",
  "crescent",
  "moon",
  "pearl",
  "emerald",
  "gemstone",
  "tourmaline",
  "gold",
]

export default async function registerNecklaceTypeTags({
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

  const toCreate = NECKLACE_TAGS.filter((t) => !existingSet.has(t))

  if (!toCreate.length) {
    logger.info("• All necklace tags already exist — nothing to create.")
  } else {
    await createProductTagsWorkflow(container).run({
      input: { product_tags: toCreate.map((value) => ({ value })) },
    })
    logger.info(
      `✅ Created ${toCreate.length} new tag(s): ${toCreate.join(", ")}`
    )
  }

  const skipped = NECKLACE_TAGS.length - toCreate.length
  logger.info(
    `Done: type "${TYPE_VALUE}" ensured, ${toCreate.length} tag(s) created, ` +
      `${skipped} already present.`
  )
}
