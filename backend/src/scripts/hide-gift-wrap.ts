import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  ProductStatus,
} from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

const HANDLE = "gift-wrap"

/**
 * Take the Gift Wrap add-on OUT of the storefront so it can't be browsed or
 * bought as a standalone product.
 *
 *   npx medusa exec ./src/scripts/hide-gift-wrap.ts
 *
 * How: set the product's status to `draft`. Medusa's Store API only returns
 * PUBLISHED products, so this removes Gift Wrap from the shop grid, search,
 * related-products and its PDP (which now 404s) in one move.
 *
 * The "Wrap it for ₹50" add-on still works: it's applied server-side via
 * POST /store/carts/:id/gift-wrap, which resolves the variant by handle with
 * query.graph and adds it through addToCartWorkflow — neither path checks
 * product status, and the variant stays in the sales channel.
 *
 * Idempotent — safe to re-run.
 */
export default async function hideGiftWrap({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    filters: { handle: HANDLE },
    fields: ["id", "title", "status"],
  })
  const product = (products as any[])?.[0]

  if (!product) {
    logger.error(
      `No product with handle "${HANDLE}". Seed it first: ` +
        `npx medusa exec ./src/scripts/seed-gift-wrap-product.ts`
    )
    return
  }

  if (product.status === ProductStatus.DRAFT) {
    logger.info(
      `• "${product.title}" is already draft — hidden from the storefront. ` +
        `Nothing to do.`
    )
    return
  }

  await updateProductsWorkflow(container).run({
    input: {
      selector: { id: product.id },
      update: { status: ProductStatus.DRAFT },
    },
  })

  logger.info(
    `✅ "${product.title}" set to draft — removed from the store listing, ` +
      `search and PDP. The gift-wrap add-on still applies via the cart route.`
  )
}
