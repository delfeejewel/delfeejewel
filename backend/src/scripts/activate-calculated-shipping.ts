import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Flip Standard & Express shipping from flat to CALCULATED, so the Shiprocket
 * provider's `calculatePrice` runs (live courier cost + the client's free-ship
 * rule: ₹0 when item subtotal > ₹5,000 AND courier cost < ₹400).
 *
 * ⚠️ DEPLOY-ORDER CRITICAL — the DB is shared with production.
 *   1. Deploy the fixed backend code (service.ts calculatePrice) to the droplet.
 *   2. ONLY THEN run this script.
 * Running it while ANY server still has the old `rate * 100` code would quote
 * ~100× shipping (e.g. ₹6,500). To roll back, use `flat` + restore ₹99/₹299.
 */
export default async function run({ container }: ExecArgs) {
  const q = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await q.graph({
    entity: "shipping_option",
    fields: ["id", "name", "price_type"],
  })
  const targets = (data as any[]).filter(
    (s) =>
      ["Standard Shipping", "Express Shipping"].includes(s.name) &&
      s.price_type !== "calculated"
  )
  if (!targets.length) {
    console.log("nothing to flip (already calculated)")
  }
  for (const s of targets) {
    await updateShippingOptionsWorkflow(container).run({
      input: [{ id: s.id, price_type: "calculated" as const }],
    })
    console.log(`${s.name} (${s.id}) -> calculated`)
  }
  const { data: after } = await q.graph({
    entity: "shipping_option",
    fields: ["name", "price_type", "provider_id"],
  })
  for (const s of after as any[])
    console.log(`  ${s.name}: ${s.price_type} (${s.provider_id})`)
}
