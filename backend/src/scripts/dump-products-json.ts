import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { promises as fs } from "fs"
import path from "path"

/**
 * Dump every product to JSON for the spreadsheet exporter.
 *
 *   npx medusa exec ./src/scripts/dump-products-json.ts [outfile]
 *
 * Default outfile is ../Products/sheet-export/products-dump.json. The companion
 * script Products/sheet-export/build-sheets.py turns this into the per-category
 * Delfee-*.xlsx workbooks.
 */
export default async function dumpProductsJson({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const selfIdx = process.argv.findIndex((a) =>
    a.endsWith("dump-products-json.ts")
  )
  const outArg = selfIdx === -1 ? undefined : process.argv[selfIdx + 1]
  const repoRoot = path.resolve(process.cwd(), "..")
  const out =
    outArg ||
    path.join(repoRoot, "Products", "sheet-export", "products-dump.json")

  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "title",
      "subtitle",
      "description",
      "status",
      "created_at",
      "is_giftcard",
      "discountable",
      "metadata",
      "type.value",
      "categories.name",
      "categories.handle",
      "collection.title",
      "tags.value",
      "variants.id",
    ],
    pagination: { take: 2000, skip: 0 },
  })

  const rows = (data as any[]).map((p) => ({
    handle: p.handle,
    title: p.title,
    subtitle: p.subtitle,
    description: p.description,
    status: p.status,
    created_at: p.created_at,
    gift_ready: !!(p.metadata || {}).gift_ready,
    variants_exist: (p.variants?.length ?? 0) > 0,
    discountable: !!p.discountable,
    type: p.type?.value ?? "",
    categories: (p.categories || []).map((c: any) => c.name),
    category_handles: (p.categories || []).map((c: any) => c.handle),
    collection: p.collection?.title ?? "",
    tags: (p.tags || []).map((t: any) => t.value),
  }))

  await fs.writeFile(out, JSON.stringify(rows, null, 2), "utf8")
  logger.info(`wrote ${rows.length} products -> ${out}`)
}
