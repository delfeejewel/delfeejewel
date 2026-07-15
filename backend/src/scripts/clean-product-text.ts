/**
 * Clean live product copy:
 *   - strip accents (é -> e) in title/subtitle/description/material
 *   - replace hyphens with spaces in TITLE + SUBTITLE + DESCRIPTION
 *   - replace em-dashes (—) with ", " in all fields
 * Dry-run by default (prints before/after). Pass `apply` to write.
 *   npx medusa exec ./src/scripts/clean-product-text.ts          # preview
 *   npx medusa exec ./src/scripts/clean-product-text.ts apply    # write
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "")
const emDash = (s: string) =>
  s
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ", ")
    .replace(/,\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim()
const deHyphen = (s: string) => s.replace(/-/g, " ").replace(/\s{2,}/g, " ").trim()

export default async function clean({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const apply = process.argv.includes("apply")

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "subtitle", "description", "material"],
    pagination: { take: 1000, skip: 0 },
  })

  const updates: any[] = []
  let changedFields = 0
  for (const p of products as any[]) {
    const next: any = { id: p.id }
    let changed = false
    const transform = (v: string | null, dropHyphens: boolean) => {
      if (!v) return v
      let out = emDash(stripAccents(v))
      if (dropHyphens) out = deHyphen(out)
      return out
    }
    for (const [f, dropHyphens] of [
      ["title", true],
      ["subtitle", true],
      ["description", true],
      ["material", false],
    ] as [string, boolean][]) {
      const before = p[f]
      const after = transform(before, dropHyphens)
      if (before && after !== before) {
        next[f] = after
        changed = true
        changedFields++
        logger.info(`\n[${f}] ${p.handle}`)
        logger.info(`  - ${before}`)
        logger.info(`  + ${after}`)
      }
    }
    if (changed) updates.push(next)
  }

  logger.info(`\n===== ${updates.length} products, ${changedFields} fields changed =====`)
  if (!apply) {
    logger.info("DRY RUN — no writes. Re-run with `apply` to persist.")
    return
  }
  // chunk to keep the workflow payload reasonable
  for (let i = 0; i < updates.length; i += 25) {
    await updateProductsWorkflow(container).run({
      input: { products: updates.slice(i, i + 25) },
    })
  }
  logger.info(`✅ Applied to ${updates.length} products.`)
}
