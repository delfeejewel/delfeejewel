import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Set the compare-at price ("MRP") on every variant, derived from its current
 * selling price.
 *
 * The storefront treats the live `price` row as the Final Selling Price and
 * `variant.metadata.mrp` as the MRP shown struck through beside it
 * (see `get-product-price.ts` and the "Compare-at price (MRP)" admin widget).
 * This script fills that metadata in bulk instead of one product at a time.
 *
 * Usage (DRY RUN by default — prints the table and writes nothing):
 *   npx medusa exec ./src/scripts/set-mrp.ts
 *   npx medusa exec ./src/scripts/set-mrp.ts apply
 *
 * Options (any order, all optional):
 *   apply           actually write; without it you only get the preview
 *   x1.5            multiplier applied to the selling price (default 1.5)
 *   round=10        round the result to the nearest N rupees (default 10;
 *                   round=1 keeps the exact figure)
 *   only=<handle>   restrict to a single product, for spot-checking
 *   clear           remove `metadata.mrp` from every variant instead
 *   all             include the utility SKUs excluded by default (see below)
 *
 * Idempotent: the MRP is always recomputed from the CURRENT selling price, so
 * re-running after a price change re-derives it rather than compounding.
 * Variants with no price are skipped, and so is any result that doesn't land
 * strictly above the selling price (the storefront hides those anyway).
 */
/**
 * Add-ons and service line-items, not retail goods — a struck-through "MRP"
 * on a ₹50 gift wrap reads as a fake discount. Pass `all` to override.
 */
const EXCLUDED_HANDLES = new Set(["gift-wrap"])
const EXCLUDED_CATEGORIES = new Set(["Services"])

export default async function setMrp({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // ─── Args — only what comes AFTER the script path ────────────────────
  const scriptIdx = process.argv.findIndex((a) => a.endsWith("set-mrp.ts"))
  const argv = scriptIdx >= 0 ? process.argv.slice(scriptIdx + 1) : []

  const apply = argv.includes("apply")
  const clear = argv.includes("clear")
  const includeAll = argv.includes("all")
  const only = argv.find((a) => a.startsWith("only="))?.slice(5)

  const multiplier = Number(
    argv.find((a) => /^x[\d.]+$/.test(a))?.slice(1) ?? "1.5"
  )
  const round = Number(argv.find((a) => a.startsWith("round="))?.slice(6) ?? "10")

  if (!Number.isFinite(multiplier) || multiplier <= 1) {
    logger.error(`Multiplier must be a number above 1 (got "${multiplier}").`)
    return
  }
  if (!Number.isFinite(round) || round < 1) {
    logger.error(`round= must be 1 or more (got "${round}").`)
    return
  }

  // ─── Load every live variant with its calculated selling price ───────
  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "status",
      "categories.name",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.metadata",
      "variants.prices.amount",
      "variants.prices.currency_code",
    ],
    filters: only ? { handle: only } : {},
  })

  if (!products.length) {
    logger.error(only ? `No product with handle "${only}".` : "No products found.")
    return
  }

  type Row = {
    product: string
    variant: string
    sku: string | null
    price: number | null
    current: number | null
    next: number | null
    note: string
  }

  const rows: Row[] = []
  const updates: { id: string; metadata: Record<string, unknown> }[] = []

  let excluded = 0

  for (const product of products) {
    const isUtility =
      EXCLUDED_HANDLES.has(product.handle) ||
      (product.categories ?? []).some((c: any) => EXCLUDED_CATEGORIES.has(c?.name))

    if (isUtility && !includeAll && !clear) {
      excluded += (product.variants ?? []).length
      continue
    }

    for (const variant of product.variants ?? []) {
      const inr = (variant.prices ?? []).find(
        (p: any) => p.currency_code?.toLowerCase() === "inr"
      )
      const price = inr?.amount == null ? null : Number(inr.amount)
      const metadata = (variant.metadata ?? {}) as Record<string, unknown>
      const currentRaw = metadata.mrp
      const current =
        currentRaw === null || currentRaw === undefined || currentRaw === ""
          ? null
          : Number(String(currentRaw).replace(/,/g, ""))

      const row: Row = {
        product: product.title,
        variant: variant.title ?? "",
        sku: variant.sku ?? null,
        price,
        current: Number.isFinite(current as number) ? (current as number) : null,
        next: null,
        note: "",
      }

      if (clear) {
        if (row.current === null) {
          row.note = "already clear"
        } else {
          row.note = "clear"
          const { mrp: _drop, ...rest } = metadata
          updates.push({ id: variant.id, metadata: rest })
        }
        rows.push(row)
        continue
      }

      if (price === null) {
        row.note = "skipped — no INR price"
        rows.push(row)
        continue
      }

      const next = Math.round((price * multiplier) / round) * round
      row.next = next

      if (next <= price) {
        // Can't happen at 1.5x, but a low multiplier plus coarse rounding could
        // land on or below the selling price — the storefront would hide it.
        row.note = "skipped — not above selling price"
      } else if (row.current === next) {
        row.note = "unchanged"
      } else {
        row.note = row.current === null ? "set" : "updated"
        updates.push({ id: variant.id, metadata: { ...metadata, mrp: next } })
      }

      rows.push(row)
    }
  }

  // ─── Report ──────────────────────────────────────────────────────────
  const tally = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.note] = (acc[r.note] ?? 0) + 1
    return acc
  }, {})

  const mode = clear
    ? "CLEAR metadata.mrp"
    : `MRP = selling x ${multiplier}${round > 1 ? `, rounded to nearest ${round}` : ""}`

  logger.info(`\n${mode}`)
  logger.info(`${products.length} products / ${rows.length} variants`)
  if (excluded) {
    logger.info(`${excluded} utility variant(s) excluded — pass "all" to include them`)
  }

  const sample = rows.filter((r) => r.note === "set" || r.note === "updated").slice(0, 15)
  if (sample.length) {
    logger.info("\nSample:")
    for (const r of sample) {
      logger.info(
        `  ${r.product} — ${r.variant} (${r.sku ?? "no sku"}): ` +
          `₹${r.price} → MRP ₹${r.next}`
      )
    }
    if (updates.length > sample.length) {
      logger.info(`  … and ${updates.length - sample.length} more`)
    }
  }

  logger.info("\nTotals:")
  for (const [note, count] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    logger.info(`  ${note}: ${count}`)
  }

  if (!updates.length) {
    logger.info("\nNothing to write.")
    return
  }

  if (!apply) {
    logger.info(
      `\nDRY RUN — ${updates.length} variant(s) would be written. ` +
        `Re-run with "apply" to commit.`
    )
    return
  }

  // ─── Write, in batches, through the same workflow the admin uses ─────
  const BATCH = 50
  let written = 0

  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH)
    await updateProductVariantsWorkflow(container).run({
      input: { product_variants: batch },
    })
    written += batch.length
    logger.info(`  wrote ${written}/${updates.length}`)
  }

  logger.info(`\nDone — ${written} variant(s) updated.`)
}
