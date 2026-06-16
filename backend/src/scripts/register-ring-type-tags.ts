import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createProductTypesWorkflow,
  createProductTagsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Ensure the "Ring" product type exists and register every tag used by the ring
 * products in Products/products-data.md — including the later additions
 * (Prod-49 … Prod-55: colour-gemstone statement rings + men's signet rings).
 *
 *   npx medusa exec ./src/scripts/register-ring-type-tags.ts
 *
 * Idempotent: only the type/tags that don't already exist are created, so the
 * existing tags are left untouched and re-running is safe.
 */

const TYPE_VALUE = "Ring"

// Union of all tags across the ring entries in products-data.md.
const RING_TAGS = [
  // core ring tags (Prod-01 … Prod-22)
  "silver",
  "dainty",
  "solitaire",
  "everyday",
  "minimalist",
  "stackable",
  "cz",
  "pave",
  "crossover",
  "kiss",
  "geometric",
  "cluster",
  "clover",
  "bezel",
  "bow",
  "feminine",
  "heart",
  "love",
  "three-stone",
  "baguette",
  "statement",
  "amethyst",
  "purple",
  "paisley",
  "leaf",
  "bypass",
  "halo",
  "swirl",
  "adjustable",
  "six-prong",
  "classic",
  "four-prong",
  "cushion",
  "art-deco",
  "link",
  "vintage",
  "filigree",
  "openwork",
  "octagon",
  "cocktail",
  "quatrefoil",
  "motif",
  "bar",
  "mandala",
  "rosette",
  "boho",
  "double-halo",
  // later additions (Prod-49 … Prod-55)
  "floral",
  "flower",
  "emerald",
  "green",
  "emerald-cut",
  "ruby",
  "red",
  "pear",
  "oval",
  "mens",
  "signet",
  "onyx",
  "black",
  "star",
  "blue",
  "sapphire",
  "engagement",
]

export default async function registerRingTypeTags({ container }: ExecArgs) {
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

  const toCreate = RING_TAGS.filter((t) => !existingSet.has(t))

  if (!toCreate.length) {
    logger.info("• All ring tags already exist — nothing to create.")
  } else {
    await createProductTagsWorkflow(container).run({
      input: { product_tags: toCreate.map((value) => ({ value })) },
    })
    logger.info(
      `✅ Created ${toCreate.length} new tag(s): ${toCreate.join(", ")}`
    )
  }

  const skipped = RING_TAGS.length - toCreate.length
  logger.info(
    `Done: type "${TYPE_VALUE}" ensured, ${toCreate.length} tag(s) created, ` +
      `${skipped} already present.`
  )
}
