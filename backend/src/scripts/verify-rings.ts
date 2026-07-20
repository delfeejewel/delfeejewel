import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import fs from "fs"

const TSV = "/Users/wft-dev16/.claude/jobs/d54d057a/tmp/rings-master.tsv"

type Row = { handle: string; action: string; sizes: string[]; price?: number; coll?: string }
function parse(): Row[] {
  const out: Row[] = []
  for (const line of fs.readFileSync(TSV, "utf8").split("\n")) {
    if (!line.trim()) continue
    const c = line.split("\t")
    const sizesRaw = (c[2] || "").trim()
    const priceRaw = (c[3] || "").trim()
    const sizes = sizesRaw ? sizesRaw.split(",").map((s) => s.trim()).filter(Boolean) : []
    const seen = new Set<string>()
    const uniq = sizes.filter((s) => (seen.has(s) ? false : (seen.add(s), true)))
    out.push({
      handle: c[0].trim(),
      action: (c[1] || "").trim(),
      sizes: uniq,
      price: priceRaw && /^\d+$/.test(priceRaw) ? parseInt(priceRaw, 10) : undefined,
      coll: (c[4] || "").trim() || undefined,
    })
  }
  return out
}

export default async function verify({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const rows = parse()
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "handle",
      "status",
      "collection.title",
      "variants.sku",
      "variants.title",
      "variants.options.value",
      "variants.options.option.title",
      "variants.prices.amount",
      "variants.prices.currency_code",
      "variants.inventory_items.inventory.location_levels.stocked_quantity",
    ],
    filters: { handle: rows.map((r) => r.handle) } as any,
  })
  const by = new Map((data as any[]).map((p) => [p.handle, p]))
  const problems: string[] = []
  let okPub = 0, okUnpub = 0
  for (const r of rows) {
    const p = by.get(r.handle)
    if (!p) { problems.push(`MISSING ${r.handle}`); continue }
    if (r.action === "unpub") {
      if (p.status !== "draft") problems.push(`NOT-DRAFT ${r.handle} status=${p.status}`)
      else okUnpub++
      continue
    }
    const issues: string[] = []
    if (p.status !== "published") issues.push(`status=${p.status}`)
    // sizes
    if (r.sizes.length) {
      const cur = (p.variants || []).map((v: any) => {
        const sv = (v.options || []).find((o: any) => o.option?.title === "Size")
        return String(sv?.value ?? v.title)
      }).sort()
      const want = [...r.sizes].map(String).sort()
      if (JSON.stringify(cur) !== JSON.stringify(want))
        issues.push(`sizes cur=[${cur}] want=[${want}]`)
    }
    // price
    if (r.price !== undefined) {
      for (const v of p.variants || []) {
        const inr = (v.prices || []).find((x: any) => x.currency_code === "inr")
        if (!inr || Number(inr.amount) !== r.price) {
          issues.push(`price ${v.sku}=${inr?.amount} want=${r.price}`); break
        }
      }
    }
    // collection
    if (r.coll === "cz" && p.collection?.title !== "CZ Micro Rings")
      issues.push(`coll=${p.collection?.title || "—"}`)
    // stock (new variants should be >0 after set-stock)
    let zero = 0
    for (const v of p.variants || [])
      for (const ii of v.inventory_items || [])
        for (const l of ii.inventory?.location_levels || [])
          if (!l.stocked_quantity) zero++
    if (zero) issues.push(`${zero} variant(s) at 0 stock`)

    if (issues.length) problems.push(`${r.handle}: ${issues.join(" | ")}`)
    else okPub++
  }
  console.log("VERIFY_START")
  console.log(`published OK: ${okPub}/${rows.filter((r) => r.action !== "unpub").length}`)
  console.log(`unpublished OK: ${okUnpub}/${rows.filter((r) => r.action === "unpub").length}`)
  if (problems.length) {
    console.log(`PROBLEMS (${problems.length}):`)
    for (const p of problems) console.log("  " + p)
  } else console.log("ALL RINGS MATCH THE SHEET.")
  console.log("VERIFY_END")
}
