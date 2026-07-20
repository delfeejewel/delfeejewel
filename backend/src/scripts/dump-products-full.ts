import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// TSV dump of every product with the columns the Delfee sheets use.
export default async function dump({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "handle",
      "title",
      "subtitle",
      "description",
      "status",
      "discountable",
      "metadata",
      "created_at",
      "type.value",
      "categories.name",
      "tags.value",
      "variants.id",
      "variants.sku",
    ],
    pagination: { take: 1000, skip: 0 },
  })
  const esc = (v: any) =>
    (v === null || v === undefined ? "" : String(v))
      .replace(/\t/g, " ")
      .replace(/\r?\n/g, " ")
      .trim()
  console.log("DUMP_START")
  console.log(
    [
      "handle",
      "title",
      "subtitle",
      "description",
      "status",
      "gift_ready",
      "discountable",
      "variants",
      "type",
      "category",
      "tags",
      "created_at",
    ].join("\t")
  )
  for (const p of data as any[]) {
    const giftReady = p.metadata?.gift_ready ? "Yes" : "No"
    const cat = p.categories?.[0]?.name || ""
    const tags = (p.tags || []).map((t: any) => t.value).join(", ")
    const nVar = (p.variants || []).length
    const created = p.created_at ? String(p.created_at).slice(0, 10) : ""
    console.log(
      [
        esc(p.handle),
        esc(p.title),
        esc(p.subtitle),
        esc(p.description),
        esc(p.status),
        giftReady,
        p.discountable ? "Yes" : "No",
        nVar > 0 ? "Yes" : "No",
        esc(p.type?.value),
        esc(cat),
        esc(tags),
        created,
      ].join("\t")
    )
  }
  console.log("DUMP_END")
}
