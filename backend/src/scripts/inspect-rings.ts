import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const HANDLES = [
  "kite-solitaire-ring",
  "petite-pave-dot-ring",
  "swirl-halo-ring",
  "mens-onyx-star-signet-ring",
  "aria-split-shank-solitaire-ring",
  "six-prong-solitaire-ring",
]

export default async function inspect({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "handle",
      "status",
      "metadata",
      "collection.id",
      "collection.title",
      "options.title",
      "options.values.value",
      "variants.title",
      "variants.sku",
      "variants.options.value",
      "variants.prices.amount",
      "variants.prices.currency_code",
    ],
    filters: { handle: HANDLES } as any,
  })
  for (const p of data as any[]) {
    console.log(`\n=== ${p.handle}  [${p.status}]  collection=${p.collection?.title || "—"}`)
    console.log("  metadata:", JSON.stringify(p.metadata || {}))
    console.log("  options:", (p.options || []).map((o: any) => `${o.title}=[${(o.values||[]).map((v:any)=>v.value).join(",")}]`).join(" | "))
    for (const v of p.variants || []) {
      const inr = (v.prices || []).find((x: any) => x.currency_code === "inr")
      console.log(`   variant "${v.title}" sku=${v.sku} opts=${(v.options||[]).map((o:any)=>o.value).join(",")} inr=${inr?.amount}`)
    }
  }
  // also list all collections
  const { data: cols } = await query.graph({ entity: "product_collection", fields: ["id","title","handle"] })
  console.log("\nCOLLECTIONS:", (cols as any[]).map((c)=>`${c.title}(${c.handle})`).join(", ") || "(none)")
}
