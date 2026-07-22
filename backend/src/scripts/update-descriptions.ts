import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import fs from "fs"
import path from "path"

/**
 * Bulk-update product descriptions from a plain-text copy document.
 *
 * Usage (DRY RUN by default — always preview before writing):
 *   npx medusa exec ./src/scripts/update-descriptions.ts ./descriptions.txt
 *   npx medusa exec ./src/scripts/update-descriptions.ts ./descriptions.txt apply
 *
 * Input format — one numbered block per product, product matched by the URL:
 *
 *   1. Peridot Crystal Bead Necklace (https://delfee.in/in/products/peridot-crystal-bead-necklace)
 *   <intro paragraph>
 *   The Design:
 *   <paragraph or bullet lines>
 *   Product Details:
 *   <bullet lines>
 *   Why You'll Love It:
 *   <bullet lines>
 *   Styling Tip:
 *   <paragraph>
 *   Meta Title: ...
 *   Meta description: ...
 *
 * Produces the HTML shape the storefront renders (it sanitises + styles h2/h3/
 * ul/li/p), e.g.
 *   <p>intro</p><h2>The Design:</h2><ul><li>…</li></ul>…<h3>Styling Tip:</h3><p>…</p>
 *
 * Meta Title / Meta description are NOT put in the description — they're stored
 * on product.metadata (seo_title / seo_description) so they can drive SEO later
 * without polluting the visible copy.
 */

// Section heading -> heading level. Order here is also the output order.
const SECTIONS: { key: string; match: RegExp; tag: "h2" | "h3" }[] = [
  { key: "The Design:", match: /^the design:?$/i, tag: "h2" },
  { key: "Product Details:", match: /^product details:?$/i, tag: "h2" },
  { key: "Why You'll Love It:", match: /^why you[''’]?ll love it:?$/i, tag: "h2" },
  { key: "Styling Tip:", match: /^styling tips?:?$/i, tag: "h3" },
]

const META_TITLE = /^meta title:\s*(.+)$/i
const META_DESC = /^meta description:\s*(.+)$/i

/**
 * "Price:" and "Available Sizes:" are DIRECTIVES, not copy — they're stripped
 * from the rendered description and applied to the product instead. A price
 * baked into description HTML silently goes stale the moment it changes; the
 * page already renders the live price and size selector.
 *
 * NB `^sizes?:` is anchored so lines like "Chain Length: 18"–19"" are untouched.
 */
const PRICE_LINE = /^price:\s*₹?\s*([\d,]+(?:\.\d+)?)/i
const SIZES_LINE = /^(?:available\s+)?sizes?:\s*(.+)$/i

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim()

type Block = {
  index: number
  title: string
  handle: string
  intro: string[]
  sections: Record<string, string[]>
  seoTitle?: string
  seoDesc?: string
  price?: number
  sizes?: string[]
}

function handleFromUrl(url: string): string {
  // …/products/<handle>  (tolerates a trailing slash / stray space in the URL)
  const clean = url.trim().replace(/\s+/g, "")
  const m = clean.match(/\/products\/([^/?#]+)/i)
  return (m ? m[1] : clean.split("/").filter(Boolean).pop() || "").toLowerCase()
}

function parse(raw: string): Block[] {
  const lines = raw.split(/\r?\n/)
  const blocks: Block[] = []
  let current: Block | null = null
  let currentSection: string | null = null

  const headerRe = /^\s*(\d+)\.\s*(.+?)\s*\(\s*(https?:\/\/[^)]+?)\s*\)\s*$/

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const header = line.match(headerRe)

    if (header) {
      if (current) blocks.push(current)
      current = {
        index: Number(header[1]),
        title: header[2].trim(),
        handle: handleFromUrl(header[3]),
        intro: [],
        sections: {},
      }
      currentSection = null
      continue
    }

    if (!current || !line) continue

    const mt = line.match(META_TITLE)
    if (mt) {
      current.seoTitle = mt[1].trim()
      continue
    }
    const md = line.match(META_DESC)
    if (md) {
      current.seoDesc = md[1].trim()
      continue
    }

    const section = SECTIONS.find((s) => s.match.test(line))
    if (section) {
      currentSection = section.key
      current.sections[currentSection] ||= []
      continue
    }

    // Directives: captured then dropped, so they never reach the description.
    const price = line.match(PRICE_LINE)
    if (price) {
      current.price = Number(price[1].replace(/,/g, ""))
      continue
    }
    const sizes = line.match(SIZES_LINE)
    if (sizes) {
      const parsed = sizes[1]
        .split(/[,/|]/)
        .map((s) => s.trim())
        .filter(Boolean)
      // dedupe, preserve order
      const seen = new Set<string>()
      current.sizes = parsed.filter((s) =>
        seen.has(s.toLowerCase()) ? false : (seen.add(s.toLowerCase()), true)
      )
      continue
    }

    if (currentSection) current.sections[currentSection].push(line)
    else current.intro.push(line)
  }

  if (current) blocks.push(current)
  return blocks
}

/**
 * Multiple lines read as bullets; a single line reads as prose. This matches
 * how the copy is actually written (Product Details is a spec list, Styling Tip
 * is a sentence) without needing the author to mark anything up.
 */
function renderSection(lines: string[]): string {
  const items = lines.filter(Boolean)
  if (!items.length) return ""
  if (items.length === 1) return `<p>${esc(items[0])}</p>`
  return `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
}

function toHtml(b: Block): string {
  const parts: string[] = []
  for (const line of b.intro.filter(Boolean)) parts.push(`<p>${esc(line)}</p>`)
  for (const s of SECTIONS) {
    const lines = b.sections[s.key]
    if (!lines?.length) continue
    parts.push(`<${s.tag}>${esc(s.key)}</${s.tag}>`)
    parts.push(renderSection(lines))
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
      "Usage: npx medusa exec ./src/scripts/update-descriptions.ts <file.txt> [apply]"
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
    fields: [
      "id",
      "handle",
      "title",
      "metadata",
      // Raw prices, not calculated_price — the latter needs a currency/region
      // pricing context that a CLI script doesn't have.
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.prices.amount",
      "variants.prices.currency_code",
      "variants.options.value",
      "variants.options.option.title",
      "options.id",
      "options.title",
    ],
    filters: { handle: blocks.map((b) => b.handle) } as any,
  })
  const byHandle = new Map((products as any[]).map((p) => [p.handle, p]))

  let ok = 0
  const missing: string[] = []

  for (const b of blocks) {
    const product = byHandle.get(b.handle)
    if (!product) {
      missing.push(`${b.index}. ${b.title} → handle "${b.handle}"`)
      continue
    }

    const html = toHtml(b)
    if (!html) {
      logger.warn(`  #${b.index} ${b.handle}: no content parsed — skipped`)
      continue
    }

    const existing = (product.variants || []).map((v: any) => {
      const sv = (v.options || []).find(
        (o: any) => o.option?.title?.toLowerCase() === "size"
      )
      const inr = (v.prices || []).find((p: any) => p.currency_code === "inr")
      return {
        id: v.id,
        sku: v.sku as string | null,
        size: String(sv?.value ?? v.title ?? ""),
        price: Number(inr?.amount),
      }
    })

    logger.info(
      `  #${b.index} ${b.handle} → ${html.length} chars${
        b.seoTitle ? " (+seo)" : ""
      }`
    )

    // ── price ────────────────────────────────────────────────────────────
    if (b.price !== undefined) {
      const current = existing.find((v) => Number.isFinite(v.price))?.price
      if (current !== undefined && Math.round(current) === b.price) {
        logger.info(`      price: ₹${b.price.toLocaleString("en-IN")} (unchanged)`)
      } else {
        logger.info(
          `      price: ₹${
            current !== undefined ? Math.round(current).toLocaleString("en-IN") : "—"
          } → ₹${b.price.toLocaleString("en-IN")}`
        )
      }
    }

    // ── sizes ────────────────────────────────────────────────────────────
    let removing: typeof existing = []
    if (b.sizes?.length) {
      removing = existing.filter(
        (v) => !b.sizes!.some((s) => s.toLowerCase() === v.size.toLowerCase())
      )
      const adding = b.sizes.filter(
        (s) => !existing.some((v) => v.size.toLowerCase() === s.toLowerCase())
      )
      logger.info(`      sizes: [${b.sizes.join(", ")}]`)
      if (adding.length) logger.info(`        + adding: ${adding.join(", ")}`)
      if (removing.length) {
        // Loud, because deleting a variant destroys its SKU and stock.
        logger.warn(
          `        - REMOVING ${removing.length} variant(s), losing SKU + stock: ` +
            removing.map((v) => `${v.size}(${v.sku ?? "no sku"})`).join(", ")
        )
      }
    }

    if (!apply) {
      // Print the full HTML in a dry run — the whole point is to eyeball the
      // markup before it goes on a live product page.
      console.log(`${html}\n`)
    }

    if (apply) {
      const metadata = {
        ...((product.metadata as Record<string, unknown>) || {}),
        ...(b.seoTitle ? { seo_title: b.seoTitle } : {}),
        ...(b.seoDesc ? { seo_description: b.seoDesc } : {}),
      }

      const update: any = { id: product.id, description: html, metadata }

      if (b.sizes?.length) {
        // Rebuild the Size option + variants to exactly the listed sizes.
        // Reuse an existing variant per size so its SKU/stock survive; derive
        // new SKUs from the existing prefix (e.g. RING-01-16).
        const prefix =
          (existing.find((v) => v.sku)?.sku || "").match(/^([A-Za-z]+-\d+)/)?.[1] ||
          null
        const used = new Set<string>()
        update.options = [{ title: "Size", values: b.sizes }]
        update.variants = b.sizes.map((size) => {
          const match = existing.find(
            (v) => v.size.toLowerCase() === size.toLowerCase() && !used.has(v.id)
          )
          const base: any = { title: size, options: { Size: size } }
          if (b.price !== undefined)
            base.prices = [{ amount: b.price, currency_code: "inr" }]
          if (match) {
            base.id = match.id
            used.add(match.id)
          } else if (prefix) {
            base.sku = `${prefix}-${size.replace(/\s+/g, "").toUpperCase()}`
          }
          return base
        })
      } else if (b.price !== undefined) {
        // Price only — leave variants alone.
        update.variants = existing.map((v) => ({
          id: v.id,
          prices: [{ amount: b.price, currency_code: "inr" }],
        }))
      }

      await updateProductsWorkflow(container).run({
        input: { products: [update] },
      })
    }
    ok++
  }

  console.log("")
  logger.info(`${apply ? "Updated" : "Would update"}: ${ok}/${blocks.length}`)

  if (missing.length) {
    logger.warn(`No product matched for ${missing.length} block(s):`)
    for (const m of missing) console.log(`    ${m}`)
  }
  if (!apply && ok) {
    logger.info("Re-run with `apply` as the last argument to write these.")
  }
}
