import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const TAX_REGION_ID = "txreg_01KPWVMKZWFMSX2WZAR4M6BAVV" // India

/**
 * Shipping is currently taxed via the region's default 3% GST rate (no
 * TaxRateRule scopes it away). Create a dedicated 0% rate and a
 * shipping_option-scoped rule for every active shipping option, so shipping
 * is excluded from tax while items keep the default 3% rate. Idempotent.
 */
export default async function exemptShippingFromTax({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const taxModule: any = container.resolve(Modules.TAX)

  const { data: shippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name"],
    filters: {} as any,
  })
  if (!shippingOptions?.length) {
    logger.warn("No shipping options found — nothing to exempt")
    return
  }
  logger.info(`Found ${shippingOptions.length} shipping option(s)`)

  let zeroRate = (
    await taxModule.listTaxRates({ tax_region_id: TAX_REGION_ID, code: "SHIP0" })
  )[0]
  if (!zeroRate) {
    zeroRate = await taxModule.createTaxRates({
      tax_region_id: TAX_REGION_ID,
      rate: 0,
      code: "SHIP0",
      name: "Shipping (tax-exempt)",
      is_default: false,
    })
    logger.info(`Created 0% shipping tax rate: ${zeroRate.id}`)
  } else {
    logger.info(`0% shipping tax rate already exists: ${zeroRate.id}`)
  }

  const existingRules = await taxModule.listTaxRateRules({
    tax_rate_id: zeroRate.id,
    reference: "shipping_option",
  })
  const alreadyRuled = new Set(existingRules.map((r: any) => r.reference_id))

  for (const so of shippingOptions as any[]) {
    if (alreadyRuled.has(so.id)) {
      logger.info(`${so.name}: already exempt — skipping`)
      continue
    }
    await taxModule.createTaxRateRules({
      reference: "shipping_option",
      reference_id: so.id,
      tax_rate_id: zeroRate.id,
    })
    logger.info(`${so.name} (${so.id}): exempted from tax`)
  }

  logger.info("Done.")
}
