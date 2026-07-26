import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import fs from "fs"
import path from "path"

/**
 * Set the product's Material field from the "Material: <value>" line in the
 * same rakhi copy doc used by update-rakhi-descriptions.ts. The description
 * HTML already lists it as a spec bullet — this makes it a real product
 * field too (product.material), which is what storefront SEO title/JSON-LD
 * and the admin Organize section actually read.
 *
 * Usage (DRY RUN by default):
 *   npx medusa exec ./src/scripts/set-rakhi-material.ts ./rakhi-copy.txt
 *   npx medusa exec ./src/scripts/set-rakhi-material.ts ./rakhi-copy.txt apply
 */

const HEADER_RE = /^\s*(\d+)\.\s*(.+?)\s*\(\s*(https?:\/\/[^)]+?)\s*\)\s*$/
const MATERIAL_RE = /^Material:\s*(.+)$/i

function handleFromUrl(url: string): string {
  const clean = url.trim().replace(/\s+/g, "")
  const m = clean.match(/\/products\/([^/?#]+)/i)
  return (m ? m[1] : clean.split("/").filter(Boolean).pop() || "").toLowerCase()
}

type Row = { handle: string; title: string; material: string }

function parse(raw: string): Row[] {
  const lines = raw.split(/\r?\n/)
  const rows: Row[] = []
  let current: { handle: string; title: string } | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const header = line.match(HEADER_RE)
    if (header) {
      current = { handle: handleFromUrl(header[3]), title: header[2].trim() }
      continue
    }
    if (!current || !line) continue
    const mat = line.match(MATERIAL_RE)
    if (mat) {
      rows.push({ handle: current.handle, title: current.title, material: mat[1].trim() })
      current = null // one Material line per block, expected
    }
  }
  return rows
}

export default async function run({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const fileArg = args[0]
  const apply = args.includes("apply")

  if (!fileArg) {
    logger.error("Usage: npx medusa exec ./src/scripts/set-rakhi-material.ts <file.txt> [apply]")
    return
  }

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.resolve(process.cwd(), fileArg)
  if (!fs.existsSync(filePath)) {
    logger.error(`File not found: ${filePath}`)
    return
  }

  const rows = parse(fs.readFileSync(filePath, "utf8"))
  if (!rows.length) {
    logger.error(`No "Material:" lines found.`)
    return
  }

  logger.info(
    `Parsed ${rows.length} row(s) — ${apply ? "APPLYING" : "DRY RUN (pass \`apply\` to write)"}`
  )

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "material"],
    filters: { handle: rows.map((r) => r.handle) } as any,
  })
  const byHandle = new Map((products as any[]).map((p) => [p.handle, p]))

  let ok = 0
  const missing: string[] = []

  for (const r of rows) {
    const product = byHandle.get(r.handle)
    if (!product) {
      missing.push(`${r.title} → handle "${r.handle}"`)
      continue
    }
    logger.info(`  ${r.handle}: material "${product.material || "—"}" → "${r.material}"`)

    if (apply && product.material !== r.material) {
      await updateProductsWorkflow(container).run({
        input: { products: [{ id: product.id, material: r.material }] },
      })
    }
    ok++
  }

  console.log("")
  logger.info(`${apply ? "Updated" : "Would update"}: ${ok}/${rows.length}`)
  if (missing.length) {
    logger.warn(`No product matched for ${missing.length} row(s):`)
    for (const m of missing) console.log(`    ${m}`)
  }
  if (!apply && ok) {
    logger.info("Re-run with `apply` as the last argument to write these.")
  }
}
