import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"

const HANDLE = "gift-wrap"
const PRICE_INR = 50
const SKU = "GIFT-WRAP-INR-50"

/**
 * Seeds the "Gift Wrap" product — a single ₹50 add-on variant the cart
 * surfaces via a checkbox. Not a physical product (no inventory, no
 * shipping). The order ops widget reads metadata.is_gift_wrap to flag
 * fulfillment.
 *
 * Run: npx medusa exec ./src/scripts/seed-gift-wrap-product.ts
 */
export default async function seedGiftWrapProduct({ container }: ExecArgs) {
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
    logger.info(`🎁 Gift Wrap product already exists: ${existing[0].id}`)
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
          title: "Gift Wrap",
          handle: HANDLE,
          status: ProductStatus.PUBLISHED,
          description:
            "Branded gift packaging — a hand-tied ribbon, our signature box, and a complimentary note card.",
          sales_channels: [{ id: sc.id }],
          shipping_profile_id: sp.id,
          metadata: { is_gift_wrap: true, hidden_from_storefront: true },
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
              metadata: { is_gift_wrap: true },
              options: { Type: "Standard" },
              prices: [{ amount: PRICE_INR, currency_code: "inr" }],
            },
          ],
        },
      ],
    },
  })

  const created = (result as any[])?.[0]
  logger.info(`🎁 Created Gift Wrap product: ${created?.id} (₹${PRICE_INR})`)
}
