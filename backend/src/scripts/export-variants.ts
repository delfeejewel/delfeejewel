/**
 * Export ONE ROW PER VARIANT for a client fill-in sheet.
 * Columns: Url, Product, Category, Variant, SKU, Price (INR), Weight (g),
 * then blank client columns (Dimensions, Cost Price, HSN, Notes).
 *   npx medusa exec ./src/scripts/export-variants.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { promises as fs } from "fs"
import path from "path"

const BASE = "https://delfee.in/in/products/"
const COLS = [
  "Url", "Product", "Category", "Variant", "SKU", "Price (INR)", "Weight (g)",
  "Dimensions", "Cost Price", "HSN", "Notes",
]
const cell = (v: any) => (v == null ? "" : String(v)).replace(/[\t\r\n]+/g, " ").trim()

export default async function exportVariants({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "product",
    fields: [
      "handle", "title", "categories.name",
      "variants.title", "variants.sku", "variants.weight",
      "variants.prices.amount", "variants.prices.currency_code",
    ],
    pagination: { take: 1000, skip: 0 },
  })

  const rows: string[][] = []
  let variantCount = 0
  for (const p of data as any[]) {
    const cat = p.categories?.[0]?.name || ""
    const vs = p.variants || []
    for (const v of vs) {
      variantCount++
      const inr = (v.prices || []).find((pr: any) => pr.currency_code === "inr")
      rows.push([
        BASE + p.handle,
        cell(p.title),
        cell(cat),
        cell(v.title),
        cell(v.sku),
        inr ? String(inr.amount) : "",
        v.weight != null ? String(v.weight) : "",
        "", "", "", "", // blank client columns
      ])
    }
  }
  // sort by product title, then variant title
  rows.sort((a, b) => a[1].localeCompare(b[1]) || a[3].localeCompare(b[3]))

  const outDir = path.resolve(process.cwd(), "..", "Products", "sheet-export")
  await fs.mkdir(outDir, { recursive: true })
  const tsv = [COLS.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n")
  await fs.writeFile(path.join(outDir, "All-Variants.tsv"), tsv + "\n", "utf8")

  logger.info(`\n${data.length} products → ${variantCount} variants → All-Variants.tsv`)
  logger.info("Sample:")
  for (const r of rows.slice(0, 6)) logger.info("  " + r.slice(0, 7).join(" | "))
}
