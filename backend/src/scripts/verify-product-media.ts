/**
 * Read-only: report image count + category for every product handle in the md,
 * flag any with < 2 images or no category. No writes.
 *   npx medusa exec ./src/scripts/verify-product-media.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { promises as fs } from "fs"
import path from "path"

export default async function verify({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const repoRoot = path.resolve(process.cwd(), "..")
  const md = await fs.readFile(path.join(repoRoot, "Products", "products-data.md"), "utf8")
  const handles = [...md.matchAll(/\*\*Handle:\*\*\s*`([^`]+)`/g)].map((m) => m[1])

  let ok = 0
  const problems: string[] = []
  for (const handle of handles) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "images.url", "categories.name"],
      filters: { handle },
    })
    const p: any = data[0]
    if (!p) { problems.push(`${handle}: NOT FOUND`); continue }
    const imgs = p.images?.length ?? 0
    const cat = p.categories?.[0]?.name ?? "—"
    if (imgs < 2 || cat === "—") problems.push(`${handle}: ${imgs} imgs, cat=${cat}`)
    else ok++
  }
  logger.info(`\n${ok}/${handles.length} products OK (>=2 images + category)`)
  if (problems.length) {
    logger.info(`${problems.length} to review:`)
    for (const p of problems) logger.info(`  - ${p}`)
  }
}
