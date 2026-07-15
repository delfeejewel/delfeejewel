import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function dump({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["handle", "categories.name"],
    pagination: { take: 1000, skip: 0 },
  })
  const rows = (data as any[])
    .map((p) => `${p.handle}\t${(p.categories?.[0]?.name) || "—"}`)
    .sort()
  console.log("HANDLES_START")
  for (const r of rows) console.log(r)
  console.log("HANDLES_END")
}
