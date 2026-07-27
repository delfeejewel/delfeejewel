import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"

const HANDLE = "cod-fee"
const PRICE_INR = 50
const SKU = "COD-FEE-INR-50"

/**
 * Seeds the "COD Handling Fee" product — a single ₹50 line item automatically
 * added when a customer chooses Cash on Delivery at checkout, and removed if
 * they switch to prepaid. Mirrors seed-gift-wrap-product.ts exactly: draft
 * status keeps it out of the storefront catalogue (Store API only returns
 * published products), no inventory/shipping — it's applied server-side via
 * POST /store/carts/:id/cod-fee, never browsed or bought directly.
 *
 * Run: npx medusa exec ./src/scripts/seed-cod-fee-product.ts
 */
export default async function seedCodFeeProduct({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelModule: any = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentModule: any = container.resolve(Modules.FULFILLMENT)

  const { data: existing } = await query.graph({
    entity: "product",
    filters: { handle: HANDLE },
    fields: ["id"],
  })
  if (existing?.length) {
    logger.info(`COD Handling Fee product already exists: ${existing[0].id}`)
    return
  }

  const [sc] = await salesChannelModule.listSalesChannels({}, { take: 1 })
  const [sp] = await fulfillmentModule.listShippingProfiles({}, { take: 1 })
  if (!sc || !sp) {
    logger.error(
      "Need a sales channel and shipping profile — run main seed first."
    )
    return
  }

  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "COD Handling Fee",
          handle: HANDLE,
          status: ProductStatus.DRAFT,
          description: "Cash on Delivery handling charge.",
          sales_channels: [{ id: sc.id }],
          shipping_profile_id: sp.id,
          metadata: { is_cod_fee: true, hidden_from_storefront: true },
          options: [
            {
              title: "Type",
              values: ["Standard"],
            },
          ],
          variants: [
            {
              title: "Standard",
              sku: SKU,
              manage_inventory: false,
              allow_backorder: true,
              metadata: { is_cod_fee: true },
              options: { Type: "Standard" },
              prices: [{ amount: PRICE_INR, currency_code: "inr" }],
            },
          ],
        },
      ],
    },
  })

  const created = (result as any[])?.[0]
  logger.info(`Created COD Handling Fee product: ${created?.id} (₹${PRICE_INR})`)
}
