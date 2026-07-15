/**
 * Read-only audit: scan live product text fields for non-ASCII characters
 * (accented letters like é in "pavé", em-dashes, ₹, etc.) and hyphens.
 * No writes. Reports per field so we can see titles vs descriptions.
 *   npx medusa exec ./src/scripts/verify-product-text.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const NON_ASCII = /[^\x00-\x7F]/
const ACCENTED = /[À-ÿ]/ // Latin-1 accented letters (é, à, ...)

export default async function verify({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "subtitle", "description", "material"],
    pagination: { take: 1000, skip: 0 },
  })

  const fields = ["title", "subtitle", "description", "material"] as const
  const accented: Record<string, number> = {}
  const otherNonAscii: Record<string, number> = {}
  const hyphenTitle: string[] = []
  const hyphenSub: string[] = []
  let hyphenDescCount = 0
  const accentSamples: string[] = []
  const nonAsciiChars = new Set<string>()

  for (const p of products as any[]) {
    for (const f of fields) {
      const v: string = p[f] || ""
      if (!v) continue
      if (ACCENTED.test(v)) {
        accented[f] = (accented[f] || 0) + 1
        if (accentSamples.length < 12) accentSamples.push(`[${f}] ${p.handle}: "${v.slice(0, 70)}"`)
      }
      if (NON_ASCII.test(v)) {
        otherNonAscii[f] = (otherNonAscii[f] || 0) + 1
        for (const ch of v) if (NON_ASCII.test(ch)) nonAsciiChars.add(ch)
      }
      if (v.includes("-")) {
        if (f === "title") hyphenTitle.push(`${p.handle}: "${v}"`)
        else if (f === "subtitle") hyphenSub.push(`${p.handle}: "${v}"`)
        else if (f === "description") hyphenDescCount++
      }
    }
  }

  logger.info(`\n===== TEXT AUDIT over ${products.length} live products =====`)
  logger.info(`\n-- Accented letters (é etc.) per field --`)
  logger.info(JSON.stringify(accented))
  logger.info(`\n-- Distinct non-ASCII chars found: ${[...nonAsciiChars].join(" ")}`)
  logger.info(`-- Non-ASCII (any) per field: ${JSON.stringify(otherNonAscii)}`)
  logger.info(`\n-- Accent samples --`)
  for (const s of accentSamples) logger.info(`   ${s}`)
  logger.info(`\n-- Hyphens in TITLE: ${hyphenTitle.length}`)
  for (const s of hyphenTitle) logger.info(`   ${s}`)
  logger.info(`\n-- Hyphens in SUBTITLE: ${hyphenSub.length}`)
  for (const s of hyphenSub) logger.info(`   ${s}`)
  logger.info(`\n-- Hyphens in DESCRIPTION: ${hyphenDescCount} products (likely legit: split-shank, three-stone, etc.)`)
}
