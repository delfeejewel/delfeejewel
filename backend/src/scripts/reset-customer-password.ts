import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Force-resets a storefront customer's password (emailpass provider).
 *
 * Run with:
 *   npx medusa exec ./src/scripts/reset-customer-password.ts <email> [password]
 *
 * If <password> is omitted it defaults to "Password123".
 */
export default async function resetCustomerPassword({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const authModule = container.resolve(Modules.AUTH)
  const customerModule = container.resolve(Modules.CUSTOMER)

  const email = (args?.[0] || "").trim().toLowerCase()
  const password = args?.[1] || "Password123"

  if (!email) {
    logger.error("Usage: medusa exec ./src/scripts/reset-customer-password.ts <email> [password]")
    return
  }

  // Sanity-check the customer exists (not strictly required for auth update)
  const customers = await customerModule.listCustomers({ email })
  if (customers.length === 0) {
    logger.warn(`No customer record found for ${email} — continuing to update auth identity anyway.`)
  } else {
    logger.info(`Customer found: ${email} (${customers[0].id})`)
  }

  const result = await authModule.updateProvider("emailpass", {
    entity_id: email,
    password,
  })

  if (!result.success) {
    logger.error(`Password reset FAILED for ${email}: ${result.error}`)
    return
  }

  logger.info("──────────────────────────────────────────────")
  logger.info(`Password reset OK for ${email}`)
  logger.info(`  New password: ${password}`)
  logger.info("  Log in at the storefront /account page.")
  logger.info("──────────────────────────────────────────────")
}
