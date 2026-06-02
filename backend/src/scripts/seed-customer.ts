import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Seeds a dummy customer that can log into the storefront, and links any
 * existing orders placed with the same email to that customer account.
 *
 * Run with: npm run seed:customer
 */

const EMAIL = "aarav.sharma@example.com"
const PASSWORD = "Password123"

export default async function seedCustomer({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const authModule = container.resolve(Modules.AUTH)
  const customerModule = container.resolve(Modules.CUSTOMER)
  const orderModule = container.resolve(Modules.ORDER)

  // ── 1. Create the customer account (or reuse if it exists) ──
  let customerId: string
  const existing = await customerModule.listCustomers({ email: EMAIL })

  if (existing.length > 0) {
    customerId = existing[0].id
    logger.info(`Customer already exists — reusing ${EMAIL} (${customerId})`)
  } else {
    const { success, authIdentity, error } = await authModule.register(
      "emailpass",
      { body: { email: EMAIL, password: PASSWORD } }
    )

    if (!success || !authIdentity) {
      logger.error(`Auth registration failed: ${error}`)
      return
    }

    const { result } = await createCustomerAccountWorkflow(container).run({
      input: {
        authIdentityId: authIdentity.id,
        customerData: {
          email: EMAIL,
          first_name: "Aarav",
          last_name: "Sharma",
          phone: "9876543210",
        },
      },
    })
    customerId = result.id
    logger.info(`Customer created: ${EMAIL} (${customerId})`)
  }

  // ── 2. Link existing orders with this email to the customer ──
  const orders = await orderModule.listOrders({ email: EMAIL } as any)
  let linked = 0
  for (const order of orders) {
    if (order.customer_id !== customerId) {
      await orderModule.updateOrders(order.id, { customer_id: customerId })
      linked++
    }
  }
  logger.info(
    `Linked ${linked} order(s) to the customer (${orders.length} found with email ${EMAIL}).`
  )

  // ── Summary ──
  logger.info("──────────────────────────────────────────────")
  logger.info("Dummy customer ready — log in on the storefront:")
  logger.info(`  Email:    ${EMAIL}`)
  logger.info(`  Password: ${PASSWORD}`)
  logger.info("  URL:      http://localhost:8000/account")
  logger.info("──────────────────────────────────────────────")
}
