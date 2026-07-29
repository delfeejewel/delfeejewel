import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Move a product into a category, replacing whatever it is filed under now.
 *
 *   npx medusa exec ./src/scripts/set-product-category.ts <product-handle> <category-handle>
 *
 *   e.g. npx medusa exec ./src/scripts/set-product-category.ts \
 *          classic-six-prong-solitaire-necklace necklace
 *
 * add-products-from-md.ts deliberately only fills in a MISSING category and
 * never overwrites an existing one, so that a bulk re-run cannot trample
 * categories curated by hand in the admin. This is the escape hatch for the
 * other case: a product that was filed under the wrong category and needs
 * correcting. It prints the before/after and refuses unknown handles.
 */
export default async function setProductCategory({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productService = container.resolve(Modules.PRODUCT)

  // `medusa exec` passes the script as a PATH ("./src/scripts/x.ts"), so match
  // on the suffix rather than an exact filename.
  const selfIdx = process.argv.findIndex((a) =>
    a.endsWith("set-product-category.ts")
  )
  const args = selfIdx === -1 ? [] : process.argv.slice(selfIdx + 1)
  const [productHandle, categoryHandle] = args
  if (!productHandle || !categoryHandle) {
    logger.error(
      "Usage: set-product-category.ts <product-handle> <category-handle>"
    )
    return
  }

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "categories.id", "categories.handle"],
    filters: { handle: productHandle },
  })
  const product: any = products[0]
  if (!product) {
    logger.error(`No product with handle "${productHandle}".`)
    return
  }

  const categories = await productService.listProductCategories({
    handle: categoryHandle,
  })
  const category = categories?.[0]
  if (!category) {
    const { data: all } = await query.graph({
      entity: "product_category",
      fields: ["handle"],
    })
    logger.error(
      `No category with handle "${categoryHandle}". Available: ` +
        all.map((c: any) => c.handle).join(", ")
    )
    return
  }

  const before = (product.categories || []).map((c: any) => c.handle)
  if (before.length === 1 && before[0] === categoryHandle) {
    logger.info(`${product.title} is already in "${categoryHandle}" — nothing to do.`)
    return
  }

  await updateProductsWorkflow(container).run({
    input: { products: [{ id: product.id, category_ids: [category.id] }] },
  })

  logger.info(
    `${product.title}: [${before.join(", ") || "none"}] -> [${categoryHandle}]`
  )
}
