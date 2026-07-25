import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * One-off backfill for guest Customer records created before the
 * order-placed subscriber started copying name/phone from the shipping
 * address (see src/subscribers/order-placed.ts).
 *
 * Medusa's core findOrCreateCustomerStep creates a guest Customer with only
 * an email — first_name/last_name/phone are left null. This script fills
 * those in from the guest's most recent order's shipping address.
 *
 * Idempotent — only touches customers still missing first_name, last_name,
 * or phone, so it's safe to re-run.
 *
 *   npx medusa exec ./src/scripts/backfill-guest-customer-details.ts
 */
export default async function backfillGuestCustomerDetails({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const customerModule: any = container.resolve(Modules.CUSTOMER)

  const { data: guests } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "has_account", "first_name", "last_name", "phone"],
    filters: { has_account: false },
  })

  const incomplete = guests.filter(
    (c: any) => !c.first_name || !c.last_name || !c.phone
  )

  logger.info(
    `Found ${guests.length} guest customers, ${incomplete.length} missing name/phone.`
  )

  let updated = 0
  let skipped = 0

  for (const customer of incomplete) {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "created_at",
        "shipping_address.first_name",
        "shipping_address.last_name",
        "shipping_address.phone",
      ],
      filters: { customer_id: customer.id },
    })

    if (!orders.length) {
      skipped++
      continue
    }

    // Most recent order's address wins.
    const latest = [...orders].sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]
    const address = (latest as any).shipping_address

    if (!address) {
      skipped++
      continue
    }

    const patch: Record<string, any> = {}
    if (!customer.first_name && address.first_name) {
      patch.first_name = address.first_name
    }
    if (!customer.last_name && address.last_name) {
      patch.last_name = address.last_name
    }
    if (!customer.phone && address.phone) {
      patch.phone = address.phone
    }

    if (Object.keys(patch).length === 0) {
      skipped++
      continue
    }

    try {
      await customerModule.updateCustomers(customer.id, patch)
      updated++
    } catch (e: any) {
      logger.warn(
        `Could not backfill customer ${customer.id} (${customer.email}): ${e?.message}`
      )
      skipped++
    }
  }

  logger.info(`Backfill done — updated ${updated}, skipped ${skipped}.`)
}
