import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"

const HANDLE = "cod-fee"
const GROSS_PRICE_INR = 60
const RATE_CODE = "GST18"
const RATE_PERCENT = 18

/**
 * Prices the COD Handling Fee at ₹60 gross and taxes it as a standalone
 * service at 18% GST instead of inheriting the 3% jewellery default.
 *
 * Prices are tax-INCLUSIVE, so ₹60 gross = ₹50.85 retained + ₹9.15 GST.
 *
 * The rate is scoped to this one product with a `product` tax rule — exactly
 * the shape the existing SHIP0 (shipping tax-exempt) rate uses for shipping
 * options — so nothing else in the catalogue is affected.
 *
 * Idempotent: safe to re-run. Only creates the rate if the code is absent,
 * and only adds the rule if it isn't already attached.
 *
 *   npx medusa exec ./src/scripts/set-cod-fee-tax.ts
 */
export default async function setCodFeeTax({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const taxModule: any = container.resolve(Modules.TAX)

  // ── locate the fee product ──────────────────────────────────────────────
  const { data: products } = await query.graph({
    entity: "product",
    filters: { handle: HANDLE },
    fields: ["id", "title", "variants.id", "variants.sku"],
  })
  const product: any = products?.[0]
  if (!product) {
    logger.error(`No product with handle "${HANDLE}" — run seed-cod-fee-product.ts first.`)
    return
  }
  const variant = product.variants?.[0]
  if (!variant) {
    logger.error(`Product ${product.id} has no variant.`)
    return
  }

  // ── 1. price → ₹60 gross ────────────────────────────────────────────────
  await updateProductVariantsWorkflow(container).run({
    input: {
      product_variants: [
        {
          id: variant.id,
          prices: [{ amount: GROSS_PRICE_INR, currency_code: "inr" }],
        },
      ],
    } as any,
  })
  logger.info(`✔ ${variant.sku}: price set to ₹${GROSS_PRICE_INR} (tax-inclusive)`)

  // ── 2. 18% rate scoped to this product ──────────────────────────────────
  const regions = await taxModule.listTaxRegions({ country_code: "in" })
  const region = regions?.[0]
  if (!region) {
    logger.error(`No "in" tax region found.`)
    return
  }

  const existing = await taxModule.listTaxRates(
    { tax_region_id: region.id, code: RATE_CODE },
    { relations: ["rules"] }
  )

  let rate: any = existing?.[0]
  if (rate) {
    logger.info(`Rate ${RATE_CODE} already exists (${rate.id}) — reusing.`)
  } else {
    const [created] = await taxModule.createTaxRates([
      {
        tax_region_id: region.id,
        code: RATE_CODE,
        name: `GST ${RATE_PERCENT}% (services)`,
        rate: RATE_PERCENT,
        is_default: false,
      },
    ])
    rate = created
    logger.info(`✔ created rate ${RATE_CODE} @ ${RATE_PERCENT}% (${rate.id})`)
  }

  const alreadyRuled = (rate.rules || []).some(
    (r: any) => r.reference === "product" && r.reference_id === product.id
  )
  if (alreadyRuled) {
    logger.info(`Rule for product ${product.id} already attached — nothing to do.`)
  } else {
    await taxModule.createTaxRateRules([
      { tax_rate_id: rate.id, reference: "product", reference_id: product.id },
    ])
    logger.info(`✔ scoped ${RATE_CODE} to product ${product.id} (${product.title})`)
  }

  logger.info(
    `\nDone. ₹${GROSS_PRICE_INR} gross → ₹${(GROSS_PRICE_INR / (1 + RATE_PERCENT / 100)).toFixed(2)} retained + ` +
      `₹${(GROSS_PRICE_INR - GROSS_PRICE_INR / (1 + RATE_PERCENT / 100)).toFixed(2)} GST.`
  )
}
