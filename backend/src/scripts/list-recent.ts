import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Read-only: list all products sorted by created_at (newest first) with their
 * created date, so we can see exactly how many were added recently.
 *   npx medusa exec ./src/scripts/list-recent.ts
 */
export default async function listRecent({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const all: any[] = []
  const limit = 100
  let offset = 0
  for (;;) {
    const { data: page } = await query.graph({
      entity: "product",
      fields: ["handle", "title", "created_at"],
      pagination: { skip: offset, take: limit },
    })
    if (!page.length) break
    all.push(...page)
    if (page.length < limit) break
    offset += limit
  }

  all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  // group by date (YYYY-MM-DD)
  const byDay: Record<string, number> = {}
  for (const p of all) {
    const day = String(p.created_at).slice(0, 10)
    byDay[day] = (byDay[day] || 0) + 1
  }

  logger.info(`📦 ${all.length} products total. Per-day created counts:`)
  for (const [day, n] of Object.entries(byDay).sort((a, b) =>
    a[0] < b[0] ? 1 : -1
  )) {
    logger.info(`   ${day}: ${n}`)
  }

  logger.info(`— Newest 40 —`)
  for (const p of all.slice(0, 40)) {
    logger.info(`   ${String(p.created_at).slice(0, 16)}  ${p.handle}`)
  }
}
