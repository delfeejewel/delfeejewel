import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Read-only dump of every product category plus the products filed under it.
 * Used to plan category restructuring; changes nothing.
 *
 *   npx medusa exec ./src/scripts/dump-categories.ts
 */
export default async function dumpCategories({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: cats } = await query.graph({
    entity: "product_category",
    fields: [
      "id",
      "name",
      "handle",
      "rank",
      "is_active",
      "is_internal",
      "parent_category_id",
    ],
  })

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "status", "categories.handle"],
    pagination: { take: 1000 },
  } as any)

  const byCat = new Map<string, string[]>()
  for (const p of products as any[]) {
    const handles = (p.categories || []).map((c: any) => c.handle)
    const key = handles.length ? handles.sort().join("+") : "(none)"
    if (!byCat.has(key)) byCat.set(key, [])
    byCat.get(key)!.push(`${p.handle} [${p.status}]`)
  }

  console.log("=== CATEGORIES ===")
  for (const c of cats as any[]) {
    console.log(
      JSON.stringify({
        id: c.id,
        name: c.name,
        handle: c.handle,
        rank: c.rank,
        active: c.is_active,
        internal: c.is_internal,
        parent: c.parent_category_id,
      })
    )
  }

  console.log(`\n=== PRODUCTS (${(products as any[]).length}) BY CATEGORY ===`)
  for (const [key, list] of [...byCat.entries()].sort()) {
    console.log(`\n--- ${key} (${list.length}) ---`)
    for (const p of list.sort()) console.log(`  ${p}`)
  }
}
