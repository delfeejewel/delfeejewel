/**
 * Export live products as one TSV per category, in the "fuller" column layout
 * (mirrors the Rings tab). Paste each file straight into its Google Sheet tab.
 *   npx medusa exec ./src/scripts/export-sheet-tabs.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { promises as fs } from "fs"
import path from "path"

const BASE = "https://delfee.in/in/products/"
const COLS = [
  "Date Created", "Url", "Current Title", "Subtitle", "Description", "Is Gift Ready",
  "Variants Exists", "Is Discountable", "Type", "Categories", "Collection", "Tags",
]
const cell = (v: any) =>
  (v == null ? "" : String(v)).replace(/[\t\r\n]+/g, " ").trim()

/** IST — the store's operating timezone; UTC dates roll a day early for evening entries. */
const istDate = (v: any) => {
  if (!v) return ""
  const d = new Date(v)
  return isNaN(d.getTime())
    ? ""
    : new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric", month: "2-digit", day: "2-digit",
      }).format(d)
}

export default async function exportTabs({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "product",
    fields: [
      "handle", "title", "subtitle", "description", "discountable", "metadata",
      "created_at", "type.value", "categories.name", "collection.title", "tags.value",
      "variants.id",
    ],
    pagination: { take: 1000, skip: 0 },
  })

  const byCat = new Map<string, { sort: string; row: string[] }[]>()
  for (const p of data as any[]) {
    const catName = p.categories?.[0]?.name || "Uncategorized"
    const row = [
      istDate(p.created_at),
      BASE + p.handle,
      cell(p.title),
      cell(p.subtitle),
      cell(p.description),
      p.metadata?.gift_ready ? "TRUE" : "FALSE",
      (p.variants?.length ?? 0) > 0 ? "TRUE" : "FALSE",
      p.discountable ? "TRUE" : "FALSE",
      cell(p.type?.value),
      cell((p.categories || []).map((c: any) => c.name).join(", ")),
      cell(p.collection?.title),
      cell((p.tags || []).map((t: any) => t.value).join(", ")),
    ]
    if (!byCat.has(catName)) byCat.set(catName, [])
    byCat.get(catName)!.push({ sort: new Date(p.created_at).toISOString(), row })
  }

  const outDir = path.resolve(process.cwd(), "..", "Products", "sheet-export")
  await fs.mkdir(outDir, { recursive: true })

  const order = [
    "Rings", "Bracelets & Bangles", "Necklaces & Pendants",
    "Earrings", "Anklets", "Mangalsutras",
  ]
  const cats = [...byCat.keys()].sort(
    (a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)
  )

  logger.info(`\nExporting ${data.length} products → ${outDir}`)
  for (const cat of cats) {
    const rows = byCat
      .get(cat)!
      .sort((a, b) => a.sort.localeCompare(b.sort) || a.row[2].localeCompare(b.row[2]))
      .map((e) => e.row)
    const tsv = [COLS.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n")
    const fname = cat.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") + ".tsv"
    await fs.writeFile(path.join(outDir, fname), tsv, "utf8")
    logger.info(`  ${fname.padEnd(24)} ${rows.length} products`)
  }
  logger.info("\nDone. Paste each .tsv into its tab (A1), tab-delimited.")
}
