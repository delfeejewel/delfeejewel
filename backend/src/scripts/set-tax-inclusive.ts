import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updatePricePreferencesWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Switch catalogue prices between tax-INCLUSIVE and tax-EXCLUSIVE.
 *
 * Medusa decides this per "price preference" — a row keyed to a region or a
 * currency. With `is_tax_inclusive = true`, the stored price IS the final
 * price: GST is back-computed out of it rather than added on top at checkout.
 *
 * Usage (DRY RUN by default):
 *   npx medusa exec ./src/scripts/set-tax-inclusive.ts            # preview
 *   npx medusa exec ./src/scripts/set-tax-inclusive.ts apply      # make inclusive
 *   npx medusa exec ./src/scripts/set-tax-inclusive.ts off apply  # back to exclusive
 *
 * WHAT THIS CHANGES FOR THE CUSTOMER
 *   Exclusive (before): ₹1,299 listed → ₹1,337.97 charged (₹38.97 GST added)
 *   Inclusive (after):  ₹1,299 listed → ₹1,299.00 charged (₹37.83 GST inside)
 *
 * So the listed number stays identical and the customer pays less. The store
 * absorbs the GST, which is a real ~2.91% cut in net revenue per item
 * (1299 / 1.03 = 1261.17 net). Raise prices separately if that isn't intended.
 */
export default async function setTaxInclusive({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const pricing = container.resolve(Modules.PRICING)

  const scriptIdx = process.argv.findIndex((a) =>
    a.endsWith("set-tax-inclusive.ts")
  )
  const argv = scriptIdx >= 0 ? process.argv.slice(scriptIdx + 1) : []

  const apply = argv.includes("apply")
  const inclusive = !argv.includes("off")

  const preferences = await pricing.listPricePreferences({})

  if (!preferences.length) {
    logger.error(
      "No price preferences exist. Medusa treats prices as tax-exclusive by " +
        "default — create a preference for the region first."
    )
    return
  }

  logger.info(`\nTarget: is_tax_inclusive = ${inclusive}`)
  logger.info("\nCurrent price preferences:")
  for (const p of preferences) {
    const change = p.is_tax_inclusive === inclusive ? "unchanged" : "WILL CHANGE"
    logger.info(
      `  ${p.attribute} = ${p.value} → is_tax_inclusive ${p.is_tax_inclusive} [${change}]`
    )
  }

  const toUpdate = preferences.filter((p) => p.is_tax_inclusive !== inclusive)

  if (!toUpdate.length) {
    logger.info("\nNothing to change — already in the requested state.")
    return
  }

  if (!apply) {
    logger.info(
      `\nDRY RUN — ${toUpdate.length} preference(s) would change. ` +
        `Re-run with "apply" to commit.`
    )
    return
  }

  await updatePricePreferencesWorkflow(container).run({
    input: {
      selector: { id: toUpdate.map((p) => p.id) },
      update: { is_tax_inclusive: inclusive },
    },
  })

  logger.info(`\nDone — ${toUpdate.length} preference(s) updated.`)
  logger.info(
    inclusive
      ? "Prices are now tax-inclusive: no GST is added at checkout."
      : "Prices are now tax-exclusive: GST is added at checkout."
  )
  logger.info(
    "Carts created before this change recalculate on their next update."
  )
}
