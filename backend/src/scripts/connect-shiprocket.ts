import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { updateShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Route fulfilment through Shiprocket.
 *
 *   npx medusa exec ./src/scripts/connect-shiprocket.ts          # apply
 *   npx medusa exec ./src/scripts/connect-shiprocket.ts -- --dry # preview only
 *
 * The Shiprocket provider is registered in medusa-config.ts, but the seeded
 * shipping options were all created with provider_id "manual_manual", so Medusa
 * never called it — no order ever reached Shiprocket. This re-points the existing
 * outbound options at the provider and links it to the stock location.
 *
 * Re-pointing (rather than deleting + recreating) keeps existing carts and the
 * order history pointing at the same shipping_option_id.
 *
 * Prices and names are left exactly as they are: flat ₹99 / ₹299. Only who
 * fulfils changes, not what the customer is charged.
 *
 * Idempotent — safe to re-run.
 */

// `${provider module id}_${service identifier}` — both are "shiprocket".
const SHIPROCKET_PROVIDER_ID = "shiprocket_shiprocket"
const MANUAL_PROVIDER_ID = "manual_manual"

export default async function connectShiprocket({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillmentModuleService: any = container.resolve(Modules.FULFILLMENT)
  const stockLocationModuleService: any = container.resolve(
    Modules.STOCK_LOCATION
  )

  // `medusa exec <script> -- --dry` does not forward the flag into `args`
  // (it arrives empty), so fall back to the raw argv.
  const dryRun =
    (args ?? []).includes("--dry") || process.argv.includes("--dry")

  logger.info(
    dryRun
      ? "DRY RUN — nothing will be written.\n"
      : "APPLYING changes (pass `-- --dry` to preview instead).\n"
  )

  // 1. Confirm the provider actually loaded. If the module failed to register,
  //    every later step would "succeed" while still being unreachable.
  const providers = await fulfillmentModuleService.listFulfillmentProviders({})
  const shiprocket = providers.find((p: any) => p.id === SHIPROCKET_PROVIDER_ID)

  if (!shiprocket) {
    logger.error(
      `Fulfillment provider "${SHIPROCKET_PROVIDER_ID}" is not registered.\n` +
        `Providers found: ${providers.map((p: any) => p.id).join(", ") || "(none)"}\n` +
        `Check the shiprocket entry in medusa-config.ts and restart the server.`
    )
    return
  }
  if (!shiprocket.is_enabled) {
    logger.warn(
      `Provider "${SHIPROCKET_PROVIDER_ID}" is registered but DISABLED — ` +
        `fulfilment will not reach Shiprocket until it is enabled.`
    )
  }
  logger.info(`✓ Provider "${SHIPROCKET_PROVIDER_ID}" is registered.`)

  // 2. Link the provider to every stock location. Medusa only offers a provider
  //    for a location it is linked to; the seed linked "manual_manual" only.
  const stockLocations = await stockLocationModuleService.listStockLocations({})
  if (!stockLocations.length) {
    logger.error("No stock location found — run the seed first.")
    return
  }

  for (const loc of stockLocations) {
    if (dryRun) {
      logger.info(`  would link ${SHIPROCKET_PROVIDER_ID} → "${loc.name}"`)
      continue
    }
    try {
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: loc.id },
        [Modules.FULFILLMENT]: {
          fulfillment_provider_id: SHIPROCKET_PROVIDER_ID,
        },
      })
      logger.info(`✓ Linked ${SHIPROCKET_PROVIDER_ID} → "${loc.name}"`)
    } catch (e: any) {
      // The link already exists — that is the desired end state, so treat a
      // duplicate as success rather than failing the whole run on re-execution.
      if (/duplicate|already exists|unique/i.test(e?.message ?? "")) {
        logger.info(`• Link to "${loc.name}" already present — skipping.`)
      } else {
        throw e
      }
    }
  }

  // 3. Re-point outbound shipping options at the provider. Return options are
  //    left alone: returns go through the manual flow / return_request module.
  const options = await fulfillmentModuleService.listShippingOptions({})
  const toMove = options.filter(
    (o: any) => o.provider_id === MANUAL_PROVIDER_ID && !o.rules?.some(
      (r: any) => r.attribute === "is_return" && r.value === "true"
    )
  )
  const already = options.filter(
    (o: any) => o.provider_id === SHIPROCKET_PROVIDER_ID
  )

  if (already.length) {
    logger.info(
      `• Already on Shiprocket: ${already.map((o: any) => o.name).join(", ")}`
    )
  }

  if (!toMove.length) {
    logger.info("Nothing left to re-point.")
  } else {
    for (const o of toMove) {
      logger.info(
        `${dryRun ? "  would re-point" : "→ re-pointing"} "${o.name}" ` +
          `(${MANUAL_PROVIDER_ID} → ${SHIPROCKET_PROVIDER_ID})`
      )
    }

    if (!dryRun) {
      await updateShippingOptionsWorkflow(container).run({
        input: toMove.map((o: any) => ({
          id: o.id,
          provider_id: SHIPROCKET_PROVIDER_ID,
        })),
      })
      logger.info(`✓ Re-pointed ${toMove.length} shipping option(s).`)
    }
  }

  logger.info(
    "\nDone. Remaining manual steps in the Shiprocket dashboard:\n" +
      "  1. Settings → Company → Pickup Addresses: the nickname must exactly match\n" +
      `     SHIPROCKET_PICKUP_LOCATION (currently "${
        process.env.SHIPROCKET_PICKUP_LOCATION || "Primary"
      }").\n` +
      "  2. Settings → API → Webhooks: point at POST /hooks/shiprocket and send\n" +
      "     SHIPROCKET_WEBHOOK_TOKEN as the x-api-key header.\n" +
      "  3. Keep the Shiprocket wallet funded — AWB assignment fails on zero balance."
  )
}
