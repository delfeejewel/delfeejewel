import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * List every product that is NOT published, i.e. invisible to the storefront.
 *
 *   npx medusa exec ./src/scripts/list-draft-products.ts
 *
 * Useful after a bulk import: the md may say "Published" while the row in the
 * DB is still a draft, and the store API silently omits those rather than
 * erroring, so they are easy to miss.
 */
export default async function listDraftProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "status", "images.url"],
    pagination: { take: 1000, skip: 0 },
  })

  const byStatus: Record<string, number> = {}
  const notPublished: any[] = []
  for (const p of data as any[]) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1
    if (p.status !== "published") notPublished.push(p)
  }

  logger.info(`total products: ${data.length}`)
  logger.info(`by status: ${JSON.stringify(byStatus)}`)
  if (!notPublished.length) {
    logger.info("every product is published.")
    return
  }
  logger.info(`\nnot visible to the storefront (${notPublished.length}):`)
  for (const p of notPublished) {
    logger.info(`  [${p.status}] ${p.handle} — ${p.images?.length ?? 0} images — ${p.title}`)
  }
}
