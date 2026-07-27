import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Set metadata.seo_image = the product's thumbnail for every product in a
 * given category — used by generateMetadata() (products/[handle]/page.tsx)
 * for the OG/Twitter share image, and shown in the admin SEO widget's
 * "Meta image" field (which only displays metadata.seo_image, not the plain
 * fallback).
 *
 * Usage (DRY RUN by default):
 *   npx medusa exec ./src/scripts/set-category-meta-image.ts "Rings"
 *   npx medusa exec ./src/scripts/set-category-meta-image.ts "Rings" apply
 */
export default async function run({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const apply = args.includes("apply")
  const categoryName = args.find((a) => a !== "apply")

  if (!categoryName) {
    logger.error(
      'Usage: npx medusa exec ./src/scripts/set-category-meta-image.ts "<Category Name>" [apply]'
    )
    return
  }

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name"],
    filters: { name: categoryName } as any,
  })
  if (!categories.length) {
    logger.error(`No "${categoryName}" category found.`)
    return
  }

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "thumbnail", "metadata"],
    filters: { categories: { id: categories[0].id } } as any,
  })

  if (!products.length) {
    logger.error(`No products found in the "${categoryName}" category.`)
    return
  }

  logger.info(
    `Found ${products.length} "${categoryName}" product(s) — ${
      apply ? "APPLYING" : "DRY RUN (pass `apply` to write)"
    }`
  )

  let ok = 0
  const skipped: string[] = []

  for (const p of products as any[]) {
    if (!p.thumbnail) {
      skipped.push(`${p.handle}: no thumbnail set — skipped`)
      continue
    }
    const current = (p.metadata as Record<string, unknown> | null)?.seo_image
    if (current === p.thumbnail) {
      continue
    }
    logger.info(
      `  ${p.handle}: seo_image ${current ? `"${current}"` : "—"} → "${p.thumbnail}"`
    )

    if (apply) {
      await updateProductsWorkflow(container).run({
        input: {
          products: [
            {
              id: p.id,
              metadata: { ...(p.metadata || {}), seo_image: p.thumbnail },
            },
          ],
        },
      })
    }
    ok++
  }

  console.log("")
  logger.info(`${apply ? "Updated" : "Would update"}: ${ok}/${products.length}`)
  if (skipped.length) {
    logger.warn(`Skipped (no thumbnail):`)
    for (const s of skipped) console.log(`    ${s}`)
  }
  if (!apply && ok) {
    logger.info("Re-run with `apply` as the last argument to write these.")
  }
}
