import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Idempotently create the "Rakhis" product category (handle: rakhis) so the
 * seasonal Raksha Bandhan collection has its own storefront category.
 */
export default async function ensureRakhiCategory({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: existing } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle"],
    filters: { handle: "rakhis" } as any,
  })

  if (existing?.length) {
    logger.info(`Rakhi category already exists: ${existing[0].id}`)
    return
  }

  const { result } = await createProductCategoriesWorkflow(container).run({
    input: {
      product_categories: [
        {
          name: "Rakhis",
          handle: "rakhis",
          description:
            "Handcrafted 925 sterling silver rakhis for Raksha Bandhan.",
          is_active: true,
          is_internal: false,
        },
      ],
    },
  })
  logger.info(`Created Rakhi category: ${(result as any[])[0].id}`)
}
