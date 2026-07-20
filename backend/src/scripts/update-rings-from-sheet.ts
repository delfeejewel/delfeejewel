import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  updateProductsWorkflow,
  createCollectionsWorkflow,
} from "@medusajs/medusa/core-flows"
import fs from "fs"
import path from "path"

const TSV = "/Users/wft-dev16/.claude/jobs/d54d057a/tmp/rings-master.tsv"

type Row = { handle: string; action: string; sizes: string[]; price?: number; coll?: string }

function parse(): Row[] {
  const out: Row[] = []
  for (const line of fs.readFileSync(TSV, "utf8").split("\n")) {
    if (!line.trim()) continue
    const c = line.split("\t")
    const handle = c[0].trim()
    const action = (c[1] || "").trim()
    const sizesRaw = (c[2] || "").trim()
    const priceRaw = (c[3] || "").trim()
    const coll = (c[4] || "").trim()
    const sizes = sizesRaw ? sizesRaw.split(",").map((s) => s.trim()).filter(Boolean) : []
    // dedupe preserving order
    const seen = new Set<string>()
    const uniq = sizes.filter((s) => (seen.has(s) ? false : (seen.add(s), true)))
    const price = priceRaw && /^\d+$/.test(priceRaw) ? parseInt(priceRaw, 10) : undefined
    out.push({ handle, action, sizes: uniq, price, coll: coll || undefined })
  }
  return out
}

function skuLabel(size: string): string {
  if (/^adjustable$/i.test(size)) return "ADJ"
  if (/^free\s*size$/i.test(size)) return "FREE"
  return size.replace(/\s+/g, "").toUpperCase()
}

export default async function run({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const mode = args[0] || "plan" // plan | one <handle> | all
  const onlyHandle = mode === "one" ? args[1] : undefined

  const rows = parse()
  const targetRows =
    mode === "one" ? rows.filter((r) => r.handle === onlyHandle) : rows
  if (mode === "one" && !targetRows.length) {
    logger.error(`handle ${onlyHandle} not in TSV`)
    return
  }

  // Resolve / create the CZ Micro Rings collection
  let collId: string | undefined
  const anyCz = rows.some((r) => r.coll === "cz")
  if (anyCz && mode !== "plan") {
    const { data: cols } = await query.graph({
      entity: "product_collection",
      fields: ["id", "handle", "title"],
    })
    const existing = (cols as any[]).find(
      (c) => c.handle === "cz-micro-rings" || c.title === "CZ Micro Rings"
    )
    if (existing) collId = existing.id
    else {
      const { result } = await createCollectionsWorkflow(container).run({
        input: { collections: [{ title: "CZ Micro Rings" }] },
      })
      collId = (result as any[])[0].id
      logger.info(`Created collection CZ Micro Rings: ${collId}`)
    }
  }

  const handles = targetRows.map((r) => r.handle)
  const { data: prods } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "status",
      "options.id",
      "options.title",
      "options.values.value",
      "variants.id",
      "variants.sku",
      "variants.title",
      "variants.options.value",
      "variants.options.option.title",
    ],
    filters: { handle: handles } as any,
  })
  const byHandle = new Map((prods as any[]).map((p) => [p.handle, p]))

  for (const r of targetRows) {
    const p = byHandle.get(r.handle)
    if (!p) {
      logger.warn(`NOT FOUND: ${r.handle}`)
      continue
    }

    if (r.action === "unpub") {
      logger.info(`UNPUBLISH  ${r.handle} (was ${p.status})`)
      if (mode !== "plan") {
        await updateProductsWorkflow(container).run({
          input: { products: [{ id: p.id, status: "draft" }] },
        })
      }
      continue
    }

    // publish path
    const sizeOpt = (p.options || []).find((o: any) => o.title === "Size")
    const curVariants = (p.variants || []).map((v: any) => {
      const sv = (v.options || []).find((o: any) => o.option?.title === "Size")
      return { id: v.id, sku: v.sku, size: sv?.value ?? v.title }
    })
    // prefix from an existing sku like RING-01-16 -> RING-01
    let prefix = "RING-XX"
    const m = (curVariants[0]?.sku || "").match(/^([A-Za-z]+-\d+)/)
    if (m) prefix = m[1]

    const update: any = { id: p.id, status: "published" }
    if (r.coll === "cz" && collId) update.collection_id = collId

    if (r.sizes.length) {
      const desired = r.sizes
      const usedIds = new Set<string>()
      const desiredVariants = desired.map((size) => {
        const newSku = `${prefix}-${skuLabel(size)}`
        // reuse by exact size value, else by matching the SKU we'd generate
        // (handles renaming an existing "Default variant"/old variant whose SKU
        // equals the target SKU — avoids a create-before-delete collision)
        let cur = curVariants.find(
          (c) => String(c.size) === String(size) && !usedIds.has(c.id)
        )
        if (!cur)
          cur = curVariants.find((c) => c.sku === newSku && !usedIds.has(c.id))
        const base: any = { title: size, options: { Size: size } }
        if (r.price !== undefined)
          base.prices = [{ amount: r.price, currency_code: "inr" }]
        if (cur) {
          base.id = cur.id
          usedIds.add(cur.id)
        } else base.sku = newSku
        return base
      })
      update.options = [{ title: "Size", values: desired }]
      update.variants = desiredVariants
      const removing = curVariants
        .filter((c) => !desired.some((d) => String(d) === String(c.size)))
        .map((c) => `${c.size}(${c.sku})`)
      logger.info(
        `PUBLISH   ${r.handle}  price=${r.price ?? "—"}  sizes=[${desired.join(",")}]  removing=[${removing.join(",")}]  coll=${r.coll === "cz" ? "CZ" : "—"}`
      )
    } else {
      // no sizes given: only price/collection/status
      if (r.price !== undefined) {
        update.variants = curVariants.map((c) => ({
          id: c.id,
          prices: [{ amount: r.price, currency_code: "inr" }],
        }))
      }
      logger.info(
        `PUBLISH   ${r.handle}  price=${r.price ?? "—"}  sizes=UNCHANGED  coll=${r.coll === "cz" ? "CZ" : "—"}`
      )
    }

    if (mode !== "plan") {
      await updateProductsWorkflow(container).run({ input: { products: [update] } })
    }
  }
  logger.info(`Done (mode=${mode}).`)
}
