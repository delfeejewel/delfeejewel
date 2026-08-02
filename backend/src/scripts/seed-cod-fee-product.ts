import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { COD_FEE_BANDS } from "../utils/cod"

const HANDLE = "cod-fee"

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
          // MUST be published: Medusa's addToCartWorkflow rejects variants of
          // unpublished products ("do not exist or belong to a product that is
          // not published"), so a draft fee product can never be added to a
          // cart and POST /store/carts/:id/cod-fee 500s. Gift Wrap hit this
          // same trap and was published by hand. Keeping it out of the
          // storefront is the job of HIDDEN_PRODUCT_HANDLES on the storefront,
          // not of the draft status.
          status: ProductStatus.PUBLISHED,
          description: "Cash on Delivery handling charge.",
          sales_channels: [{ id: sc.id }],
          shipping_profile_id: sp.id,
          metadata: { is_cod_fee: true, hidden_from_storefront: true },
          // One variant per fee band (see utils/cod.ts) — Medusa prices line
          // items per variant, so a banded fee needs a variant per band. The
          // cart route picks the right one from the cart's merchandise value.
          // All are tax-INCLUSIVE gross and inherit the product-scoped GST18
          // rate (18%, service) created by scripts/set-cod-fee-tax.ts, which
          // must be run after this seed.
          options: [
            {
              title: "Type",
              values: COD_FEE_BANDS.map((b) => b.option),
            },
          ],
          variants: COD_FEE_BANDS.map((b) => ({
            title: b.option,
            sku: b.sku,
            manage_inventory: false,
            allow_backorder: true,
            metadata: { is_cod_fee: true, cod_fee_band_max: b.max },
            options: { Type: b.option },
            prices: [{ amount: b.amount, currency_code: "inr" }],
          })),
        },
      ],
    },
  })

  const created = (result as any[])?.[0]
  logger.info(
    `Created COD Handling Fee product: ${created?.id} — bands ` +
      COD_FEE_BANDS.map((b) => `₹${b.amount} (≤₹${b.max})`).join(", ")
  )
}
