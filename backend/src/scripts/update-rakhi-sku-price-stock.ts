import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import {
  createInventoryItemsWorkflow,
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
  deleteInventoryItemWorkflow,
} from "@medusajs/medusa/core-flows"
import fs from "fs"
import path from "path"

/**
 * Bulk-update SKU, price (INR), and stock quantity for single-variant
 * products from a tab-separated sheet export, matched by product URL.
 *
 * Expected columns (header row required, extra columns ignored):
 *   S.No  Product URL  Title  Yes/No  SKU  Size of Product  Price
 *   Outer Box dimension  Number of items in stock  Is it gift ready  Collection
 *
 * Usage (DRY RUN by default):
 *   npx medusa exec ./src/scripts/update-rakhi-sku-price-stock.ts ./sheet.tsv
 *   npx medusa exec ./src/scripts/update-rakhi-sku-price-stock.ts ./sheet.tsv apply
 *
 * Only touches products with exactly one variant — multi-variant products
 * (e.g. rings with sizes) don't map 1:1 to a single SKU/price/qty row and are
 * skipped with a warning.
 */

function handleFromUrl(url: string): string {
  const clean = url.trim().replace(/\s+/g, "")
  const m = clean.match(/\/products\/([^/?#]+)/i)
  return (m ? m[1] : clean.split("/").filter(Boolean).pop() || "").toLowerCase()
}

type Row = {
  lineNo: number
  handle: string
  title: string
  sku: string
  price?: number
  qty?: number
}

function parse(raw: string): Row[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim())
  const rows: Row[] = []
  for (let i = 1; i < lines.length; i++) {
    // header is lines[0]
    const cols = lines[i].split("\t")
    const [, url, title, , sku, , priceStr, , qtyStr] = cols
    if (!url || !/\/products\//.test(url)) continue
    const price = priceStr?.trim() ? Number(priceStr.trim()) : undefined
    const qty = qtyStr?.trim() ? Number(qtyStr.trim()) : undefined
    rows.push({
      lineNo: i + 1,
      handle: handleFromUrl(url),
      title: (title || "").trim(),
      sku: (sku || "").trim(),
      price: Number.isFinite(price) ? price : undefined,
      qty: Number.isFinite(qty) ? qty : undefined,
    })
  }
  return rows
}

export default async function run({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const remoteLink = container.resolve(ContainerRegistrationKeys.LINK)

  const fileArg = args[0]
  const apply = args.includes("apply")

  if (!fileArg) {
    logger.error(
      "Usage: npx medusa exec ./src/scripts/update-rakhi-sku-price-stock.ts <file.tsv> [apply]"
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

  const rows = parse(fs.readFileSync(filePath, "utf8"))
  if (!rows.length) {
    logger.error("No rows parsed — check the file is tab-separated with a header row.")
    return
  }

  // SKUs must be unique — catch sheet typos before touching the DB.
  const skuCounts = new Map<string, number>()
  for (const r of rows) if (r.sku) skuCounts.set(r.sku, (skuCounts.get(r.sku) || 0) + 1)
  const dupeSkus = [...skuCounts.entries()].filter(([, n]) => n > 1).map(([s]) => s)
  if (dupeSkus.length) {
    logger.error(`Duplicate SKU(s) in the sheet — fix before running: ${dupeSkus.join(", ")}`)
    return
  }

  logger.info(
    `Parsed ${rows.length} row(s) from ${path.basename(filePath)} — ${
      apply ? "APPLYING" : "DRY RUN (pass \`apply\` to write)"
    }`
  )

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const location = locations.find((l: any) => l.name === "Chandigarh Store") || locations[0]
  if (!location) {
    logger.error("No stock location found.")
    return
  }

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "title",
      "variants.id",
      "variants.sku",
      "variants.title",
      "variants.prices.amount",
      "variants.prices.currency_code",
      "variants.inventory.id",
      "variants.inventory.sku",
      "variants.inventory.location_levels.location_id",
      "variants.inventory.location_levels.stocked_quantity",
    ],
    filters: { handle: rows.map((r) => r.handle) } as any,
  })
  const byHandle = new Map((products as any[]).map((p) => [p.handle, p]))

  let ok = 0
  const missing: string[] = []
  const skipped: string[] = []

  for (const r of rows) {
    const product = byHandle.get(r.handle)
    if (!product) {
      missing.push(`Row ${r.lineNo}: ${r.title} → handle "${r.handle}"`)
      continue
    }
    const variants = product.variants || []
    if (variants.length !== 1) {
      skipped.push(
        `Row ${r.lineNo}: ${r.handle} has ${variants.length} variants (expected 1) — skipped`
      )
      continue
    }
    const variant = variants[0]
    const currentSku = variant.sku
    const currentPrice = (variant.prices || []).find((p: any) => p.currency_code === "inr")?.amount
    const currentQty = (variant.inventory?.[0]?.location_levels || []).find(
      (l: any) => l.location_id === location.id
    )?.stocked_quantity

    logger.info(
      `#${r.lineNo} ${r.handle}: sku ${currentSku || "—"} → ${r.sku || "(unchanged)"}, ` +
        `price ₹${currentPrice ?? "—"} → ₹${r.price ?? "(unchanged)"}, ` +
        `stock ${currentQty ?? "—"} → ${r.qty ?? "(unchanged)"}`
    )

    if (!apply) {
      ok++
      continue
    }

    // ── SKU + price (product/variant update) ──────────────────────────
    if ((r.sku && r.sku !== currentSku) || r.price !== undefined) {
      const update: any = {
        id: variant.id,
      }
      if (r.sku && r.sku !== currentSku) update.sku = r.sku
      if (r.price !== undefined) update.prices = [{ amount: r.price, currency_code: "inr" }]

      await updateProductsWorkflow(container).run({
        input: { products: [{ id: product.id, variants: [update] }] },
      })
    }

    // ── stock (inventory item + level at Chandigarh Store) ────────────
    if (r.qty !== undefined) {
      try {
        const { data: refreshed } = await query.graph({
          entity: "product",
          fields: [
            "variants.id",
            "variants.sku",
            "variants.inventory.id",
            "variants.inventory.sku",
            "variants.inventory.location_levels.location_id",
            "variants.inventory.location_levels.stocked_quantity",
          ],
          filters: { id: product.id },
        })
        const freshVariant = refreshed[0]?.variants?.find((v: any) => v.id === variant.id)
        const items: any[] = freshVariant?.inventory || []
        let keeper = items.find((it) =>
          (it.location_levels || []).some((l: any) => l.location_id === location.id)
        )
        let toDelete: any[] = []

        if (items.length === 0) {
          const { result } = await createInventoryItemsWorkflow(container).run({
            input: {
              items: [{ sku: r.sku || currentSku || undefined, title: `${product.title}` }],
            },
          })
          keeper = { ...result[0], location_levels: [] }
          await remoteLink.create([
            {
              [Modules.PRODUCT]: { variant_id: variant.id },
              [Modules.INVENTORY]: { inventory_item_id: keeper.id },
            },
          ])
        } else {
          keeper = keeper || items[0]
          toDelete = items.filter((it) => it.id !== keeper!.id)
        }

        const level = (keeper.location_levels || []).find(
          (l: any) => l.location_id === location.id
        )
        if (level) {
          await updateInventoryLevelsWorkflow(container).run({
            input: {
              updates: [
                { inventory_item_id: keeper.id, location_id: location.id, stocked_quantity: r.qty },
              ],
            },
          })
        } else {
          await createInventoryLevelsWorkflow(container).run({
            input: {
              inventory_levels: [
                { inventory_item_id: keeper.id, location_id: location.id, stocked_quantity: r.qty },
              ],
            },
          })
        }
        for (const d of toDelete) {
          await deleteInventoryItemWorkflow(container).run({ input: [d.id] })
        }
      } catch (e: any) {
        logger.error(`  ✗ ${r.handle}: stock update failed — ${e?.message || e}`)
      }
    }

    ok++
  }

  console.log("")
  logger.info(`${apply ? "Updated" : "Would update"}: ${ok}/${rows.length}`)
  if (skipped.length) {
    logger.warn(`Skipped (variant count mismatch):`)
    for (const s of skipped) console.log(`    ${s}`)
  }
  if (missing.length) {
    logger.warn(`No product matched for ${missing.length} row(s):`)
    for (const m of missing) console.log(`    ${m}`)
  }
  if (!apply && ok) {
    logger.info("Re-run with `apply` as the last argument to write these.")
  }
}
