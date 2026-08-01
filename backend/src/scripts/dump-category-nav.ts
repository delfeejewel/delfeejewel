import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Read-only: show each category's cover image and nav-visibility metadata,
 * so we can see which categories would drop out of which surfaces.
 */
export default async function run({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: cats } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle", "rank", "is_active", "is_internal", "metadata"],
  })

  for (const c of (cats as any[]).sort((a, b) => a.rank - b.rank)) {
    const m = (c.metadata || {}) as Record<string, unknown>
    console.log(
      JSON.stringify({
        handle: c.handle,
        name: c.name,
        rank: c.rank,
        active: c.is_active,
        internal: c.is_internal,
        cover: m.cover_image ? "YES" : "— none —",
        metadata_keys: Object.keys(m),
      })
    )
  }
}
