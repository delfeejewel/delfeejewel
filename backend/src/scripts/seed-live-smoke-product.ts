import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"

const HANDLE = "automated-test-do-not-buy"

/**
 * Seeds the dedicated ₹1 product used ONLY by the weekly live smoke test
 * (e2e/live-weekly-smoke.ts) and the manual live-smoke-test.spec.ts. Not
 * added to any category/collection so it doesn't surface in normal browse
 * navigation. `metadata.is_automation_test_product` lets the charge-and-
 * complete admin route (task #11) refuse to charge anything else.
 *
 * Run with: npx medusa exec ./src/scripts/seed-live-smoke-product.ts
 */
export default async function seedLiveSmokeProduct({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelModule: any = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentModule: any = container.resolve(Modules.FULFILLMENT)

  const { data: existing } = await query.graph({
    entity: "product",
    filters: { handle: HANDLE },
    fields: ["id", "variants.id", "variants.sku"],
  })
  if (existing?.length) {
    logger.info(`Live smoke test product already exists: ${existing[0].id}`)
    logger.info(
      "Set its variant id as LIVE_SMOKE_TEST_PRODUCT_ID's variant in backend.env " +
        `(variant: ${existing[0].variants?.[0]?.id})`
    )
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
          title: "[AUTOMATED TEST — DO NOT BUY]",
          handle: HANDLE,
          status: ProductStatus.PUBLISHED,
          description:
            "Used only by the automated weekly live smoke test to verify checkout, " +
            "payment, and Shiprocket AWB assignment. Every order placed on this " +
            "product is cancelled and refunded automatically within seconds. " +
            "Please do not purchase.",
          sales_channels: [{ id: sc.id }],
          shipping_profile_id: sp.id,
          metadata: { is_automation_test_product: true },
          options: [{ title: "Type", values: ["Test"] }],
          variants: [
            {
              title: "Test",
              sku: "AUTOMATED-TEST-DO-NOT-BUY",
              manage_inventory: false,
              allow_backorder: true,
              metadata: { is_automation_test_product: true },
              options: { Type: "Test" },
              prices: [{ amount: 1, currency_code: "inr" }],
            },
          ],
        },
      ],
    },
  })

  const created = (result as any[])?.[0]
  const variantId = created?.variants?.[0]?.id
  logger.info(`LIVE_SMOKE_TEST_PRODUCT_ID (backend.env): ${created?.id}`)
  logger.info(`LIVE_SMOKE_TEST_VARIANT_ID (GitHub secret): ${variantId}`)
}
