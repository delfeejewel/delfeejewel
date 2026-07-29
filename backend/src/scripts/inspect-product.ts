import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Print why a product is / isn't visible to the storefront.
 *
 *   npx medusa exec ./src/scripts/inspect-product.ts <handle>
 *
 * The store API only returns products that are `published` AND linked to the
 * sales channel of the publishable key, so a product can exist and still be
 * invisible. This dumps status, sales channels, categories and image count.
 */
export default async function inspectProduct({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const selfIdx = process.argv.findIndex((a) => a.endsWith("inspect-product.ts"))
  const handle = selfIdx === -1 ? undefined : process.argv[selfIdx + 1]
  if (!handle) {
    logger.error("Usage: inspect-product.ts <handle>")
    return
  }

  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "title",
      "status",
      "deleted_at",
      "thumbnail",
      "images.url",
      "categories.handle",
      "sales_channels.id",
      "sales_channels.name",
      "variants.id",
    ],
    filters: { handle },
  })
  const p: any = data[0]
  if (!p) {
    logger.info(`No product with handle "${handle}" (not even soft-deleted).`)
    return
  }
  logger.info(`title:          ${p.title}`)
  logger.info(`id:             ${p.id}`)
  logger.info(`status:         ${p.status}`)
  logger.info(`deleted_at:     ${p.deleted_at ?? "—"}`)
  logger.info(`images:         ${p.images?.length ?? 0}`)
  logger.info(`thumbnail:      ${p.thumbnail ?? "—"}`)
  logger.info(`categories:     ${(p.categories || []).map((c: any) => c.handle).join(", ") || "NONE"}`)
  logger.info(`sales channels: ${(p.sales_channels || []).map((s: any) => s.name).join(", ") || "NONE"}`)
  logger.info(`variants:       ${p.variants?.length ?? 0}`)
}
