import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import fs from "fs"
import path from "path"

/**
 * Bulk-update "Rakhi" category product descriptions from a plain-text copy
 * document, in the exact template Delfee writes rakhi copy in:
 *
 *   1. Butterfly CZ Silver Rakhi (https://delfee.in/in/products/butterfly-cz-silver-rakhi)
 *   <intro paragraph>
 *   The Design:
 *   <prose paragraph(s)>
 *   <Key: Value spec lines>
 *   Why You'll Love It
 *   <bullet sentence lines>
 *   Net Qty - 1 Rakhi
 *   Styling Tip:
 *   <paragraph>
 *   Meta Title: ...
 *   Meta Description: ...
 *
 * Produces:
 *   <p>intro</p>
 *   <h2>The Design:</h2><p>prose</p><ul><li>Key: Value</li>...</ul>
 *   <h2>Why You'll Love It</h2><ul><li>...</li>...</ul>
 *   <h3>Net Qty - 1 Rakhi</h3>
 *   <h3>Styling Tip:</h3><p>paragraph</p>
 *
 * Meta Title / Meta Description are NOT put in the description — they're
 * stored on product.metadata (seo_title / seo_description).
 *
 * Usage (DRY RUN by default — always preview before writing):
 *   npx medusa exec ./src/scripts/update-rakhi-descriptions.ts ./rakhi-copy.txt
 *   npx medusa exec ./src/scripts/update-rakhi-descriptions.ts ./rakhi-copy.txt apply
 */

const DESIGN_RE = /^the design:?$/i
const LOVE_RE = /^why you[''’]?ll love it:?$/i
const STYLING_RE = /^styling tips?:?$/i
const NET_QTY_RE = /^net qty\b/i
const META_TITLE_RE = /^meta title:\s*(.+)$/i
const META_DESC_RE = /^meta description:\s*(.+)$/i
const HEADER_RE = /^\s*(\d+)\.\s*(.+?)\s*\(\s*(https?:\/\/[^)]+?)\s*\)\s*$/
// "Material: 925 Sterling Silver" — a short label followed by ": " and a value.
const SPEC_LINE_RE = /^[A-Za-z][A-Za-z /()'-]{1,40}:\s+.+$/

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim()

type Section = "intro" | "design" | "love" | "styling"

type Block = {
  index: number
  title: string
  handle: string
  intro: string[]
  designLines: string[] // prose + spec lines, in order, tagged inline
  loveLines: string[]
  netQty?: string
  stylingLines: string[]
  seoTitle?: string
  seoDesc?: string
}

function handleFromUrl(url: string): string {
  const clean = url.trim().replace(/\s+/g, "")
  const m = clean.match(/\/products\/([^/?#]+)/i)
  return (m ? m[1] : clean.split("/").filter(Boolean).pop() || "").toLowerCase()
}

function parse(raw: string): Block[] {
  const lines = raw.split(/\r?\n/)
  const blocks: Block[] = []
  let current: Block | null = null
  let section: Section = "intro"

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const header = line.match(HEADER_RE)

    if (header) {
      if (current) blocks.push(current)
      current = {
        index: Number(header[1]),
        title: header[2].trim(),
        handle: handleFromUrl(header[3]),
        intro: [],
        designLines: [],
        loveLines: [],
        stylingLines: [],
      }
      section = "intro"
      continue
    }

    if (!current || !line) continue

    const mt = line.match(META_TITLE_RE)
    if (mt) {
      current.seoTitle = mt[1].trim()
      continue
    }
    const md = line.match(META_DESC_RE)
    if (md) {
      current.seoDesc = md[1].trim()
      continue
    }

    if (DESIGN_RE.test(line)) {
      section = "design"
      continue
    }
    if (LOVE_RE.test(line)) {
      section = "love"
      continue
    }
    if (STYLING_RE.test(line)) {
      section = "styling"
      continue
    }
    if (NET_QTY_RE.test(line)) {
      current.netQty = line
      continue
    }

    if (section === "intro") current.intro.push(line)
    else if (section === "design") current.designLines.push(line)
    else if (section === "love") current.loveLines.push(line)
    else if (section === "styling") current.stylingLines.push(line)
  }

  if (current) blocks.push(current)
  return blocks
}

/**
 * Design section mixes prose ("The Butterfly CZ Silver Rakhi features...")
 * with Key: Value specs. Prose lines become <p>, and runs of consecutive
 * spec lines are grouped into one <ul> each, in the order they appear.
 */
function renderDesign(lines: string[]): string {
  const parts: string[] = []
  let specBuf: string[] = []

  const flushSpecs = () => {
    if (!specBuf.length) return
    parts.push(`<ul>${specBuf.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`)
    specBuf = []
  }

  for (const line of lines) {
    if (SPEC_LINE_RE.test(line)) {
      specBuf.push(line)
    } else {
      flushSpecs()
      parts.push(`<p>${esc(line)}</p>`)
    }
  }
  flushSpecs()
  return parts.join("")
}

function renderBullets(lines: string[]): string {
  if (!lines.length) return ""
  return `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`
}

function toHtml(b: Block): string {
  const parts: string[] = []
  for (const line of b.intro) parts.push(`<p>${esc(line)}</p>`)
  if (b.designLines.length) {
    parts.push(`<h2>The Design:</h2>`)
    parts.push(renderDesign(b.designLines))
  }
  if (b.loveLines.length) {
    parts.push(`<h2>Why You'll Love It</h2>`)
    parts.push(renderBullets(b.loveLines))
  }
  if (b.netQty) parts.push(`<h3>${esc(b.netQty)}</h3>`)
  if (b.stylingLines.length) {
    parts.push(`<h3>Styling Tip:</h3>`)
    for (const line of b.stylingLines) parts.push(`<p>${esc(line)}</p>`)
  }
  return parts.join("")
}

export default async function run({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const fileArg = args[0]
  const apply = args.includes("apply")

  if (!fileArg) {
    logger.error(
      "Usage: npx medusa exec ./src/scripts/update-rakhi-descriptions.ts <file.txt> [apply]"
    )
    return
  }

  const filePath = path.isAbsolute(fileArg)
    ? fileArg
    : path.resolve(process.cwd(), fileArg)
  if (!fs.existsSync(filePath)) {
    logger.error(`File not found: ${filePath}`)
    return
  }

  const blocks = parse(fs.readFileSync(filePath, "utf8"))
  if (!blocks.length) {
    logger.error(
      "No product blocks found. Each block must start like: 1. Title (https://delfee.in/in/products/the-handle)"
    )
    return
  }

  logger.info(
    `Parsed ${blocks.length} block(s) from ${path.basename(filePath)} — ${
      apply ? "APPLYING" : "DRY RUN (pass `apply` to write)"
    }`
  )

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "metadata", "categories.name"],
    filters: { handle: blocks.map((b) => b.handle) } as any,
  })
  const byHandle = new Map((products as any[]).map((p) => [p.handle, p]))

  let ok = 0
  const missing: string[] = []
  const offCategory: string[] = []

  for (const b of blocks) {
    const product = byHandle.get(b.handle)
    if (!product) {
      missing.push(`${b.index}. ${b.title} → handle "${b.handle}"`)
      continue
    }

    const categories = ((product.categories as any[]) || []).map((c) => c.name)
    if (!categories.some((c) => /rakhi/i.test(c))) {
      offCategory.push(`${b.index}. ${b.handle} (categories: ${categories.join(", ") || "none"})`)
    }

    const html = toHtml(b)
    if (!html) {
      logger.warn(`  #${b.index} ${b.handle}: no content parsed — skipped`)
      continue
    }

    logger.info(
      `  #${b.index} ${b.handle} → ${html.length} chars${b.seoTitle ? " (+seo)" : ""}`
    )

    if (!apply) {
      console.log(`${html}\n`)
    } else {
      const metadata = {
        ...((product.metadata as Record<string, unknown>) || {}),
        ...(b.seoTitle ? { seo_title: b.seoTitle } : {}),
        ...(b.seoDesc ? { seo_description: b.seoDesc } : {}),
      }
      await updateProductsWorkflow(container).run({
        input: { products: [{ id: product.id, description: html, metadata }] },
      })
    }
    ok++
  }

  console.log("")
  logger.info(`${apply ? "Updated" : "Would update"}: ${ok}/${blocks.length}`)

  if (offCategory.length) {
    logger.warn(`Matched but NOT in a "Rakhi" category — double check these:`)
    for (const m of offCategory) console.log(`    ${m}`)
  }
  if (missing.length) {
    logger.warn(`No product matched for ${missing.length} block(s):`)
    for (const m of missing) console.log(`    ${m}`)
  }
  if (!apply && ok) {
    logger.info("Re-run with `apply` as the last argument to write these.")
  }
}
