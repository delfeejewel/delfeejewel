import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Flip Standard Shipping from flat to CALCULATED, so the Shiprocket provider's
 * `calculatePrice` actually runs: live courier cost, plus the client's rules —
 * ₹0 when the eligible item subtotal is above ₹5,000 AND the courier costs
 * under ₹400, with Coins excluded from that subtotal.
 *
 * Until this runs, shipping is a flat ₹99 for everyone: `calculatePrice` is
 * never called, so NOBODY gets free shipping and no live rates are used.
 *
 * ⚠️ DEPLOY-ORDER CRITICAL — the DB is shared with production.
 *   1. Deploy the current backend code (service.ts calculatePrice) to the droplet.
 *   2. Confirm the droplet is serving that build.
 *   3. ONLY THEN run this script.
 * Running it while any server still has the old `rate * 100` code quotes ~100×
 * shipping (₹6,500 instead of ₹65). That is the single reason this is a
 * separate, manual step rather than a migration.
 *
 * Rollback: `npx medusa exec ./src/scripts/activate-calculated-shipping.ts revert`
 * puts Standard back to flat. NOTE the flat PRICE is not restored by the revert
 * — re-set ₹99 in the admin if the price set was cleared.
 *
 * Run: npx medusa exec ./src/scripts/activate-calculated-shipping.ts [revert]
 */

const TARGET_NAME = "Standard Shipping"

export default async function run({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const q = container.resolve(ContainerRegistrationKeys.QUERY)

  const revert = (args || []).includes("revert")
  const desired = revert ? "flat" : "calculated"

  const { data } = await q.graph({
    entity: "shipping_option",
    fields: ["id", "name", "price_type", "provider_id"],
  })

  const options = (data as any[]) || []

  // Express was withdrawn — flag it rather than flipping it, so a stale row
  // can't quietly start quoting live rates for a product we no longer sell.
  const express = options.find((s) => s.name === "Express Shipping")
  if (express) {
    logger.warn(
      `"Express Shipping" (${express.id}) still exists and was NOT touched. ` +
        `It has been withdrawn — remove it before going live.`
    )
  }

  const targets = options.filter(
    (s) => s.name === TARGET_NAME && s.price_type !== desired
  )

  if (!targets.length) {
    logger.info(`Nothing to change — ${TARGET_NAME} is already "${desired}".`)
  }

  for (const s of targets) {
    await updateShippingOptionsWorkflow(container).run({
      input: [{ id: s.id, price_type: desired as "calculated" | "flat" }],
    })
    logger.info(`${s.name} (${s.id}) → ${desired}`)
  }

  const { data: after } = await q.graph({
    entity: "shipping_option",
    fields: ["name", "price_type", "provider_id"],
  })
  for (const s of after as any[]) {
    logger.info(`  ${s.name}: ${s.price_type} (${s.provider_id})`)
  }

  if (!revert) {
    logger.info(
      "Verify now: a coins-only cart must pay courier cost; a >₹5,000 " +
        "jewellery cart must ship free; neither may quote ~100× (the unit bug)."
    )
  }
}
