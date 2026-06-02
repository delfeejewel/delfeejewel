import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"

const HANDLE = "gift-card"
const DENOMINATIONS = [500, 1000, 2500, 5000]

/**
 * Seeds the "Gift Card" product with fixed-denomination variants. Variants
 * carry `metadata.is_gift_card = true` so the order subscriber can detect
 * them on purchase and issue gift-card codes.
 *
 * Run with: npx medusa exec ./src/scripts/seed-gift-card-product.ts
 */
export default async function seedGiftCardProduct({ container }: ExecArgs) {
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
    logger.info(`Gift Card product already exists: ${existing[0].id}`)
    return
  }

  const [sc] = await salesChannelModule.listSalesChannels({}, { take: 1 })
  const [sp] = await fulfillmentModule.listShippingProfiles({}, { take: 1 })
  if (!sc || !sp) {
    logger.error("Need a sales channel and shipping profile — run main seed first.")
    return
  }

  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Gift Card",
          handle: HANDLE,
          status: ProductStatus.PUBLISHED,
          description:
            "A timeless gift — let them choose the piece they'll cherish forever. Delivered instantly by email.",
          sales_channels: [{ id: sc.id }],
          shipping_profile_id: sp.id,
          metadata: { is_gift_card: true },
          options: [
            {
              title: "Denomination",
              values: DENOMINATIONS.map((d) => `INR ${d}`),
            },
          ],
          variants: DENOMINATIONS.map((d) => ({
            title: `₹${d.toLocaleString("en-IN")}`,
            sku: `GIFT-CARD-INR-${d}`,
            manage_inventory: false,
            allow_backorder: true,
            requires_shipping: false,
            metadata: { is_gift_card: true, gift_card_value: d },
            options: { Denomination: `INR ${d}` },
            prices: [{ amount: d, currency_code: "inr" }],
          })),
        },
      ],
    },
  })

  const created = (result as any[])?.[0]
  logger.info(`Created Gift Card product: ${created?.id}`)
  logger.info(
    `  Variants: ${DENOMINATIONS.map((d) => `₹${d}`).join(", ")}`
  )
}
