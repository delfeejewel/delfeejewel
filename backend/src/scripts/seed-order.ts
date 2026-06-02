import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Seeds a single order so the GST invoice endpoint can be tested.
 * Run with: npm run seed:order
 *
 * Creates the order directly via the order module (no cart/payment flow)
 * — enough for the invoice route, which only reads items + shipping address.
 */
export default async function seedOrder({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orderModuleService = container.resolve(Modules.ORDER)
  const regionModuleService = container.resolve(Modules.REGION)

  // An order only needs a currency; use an existing INR region if seeded.
  let regionId: string | undefined
  let currencyCode = "inr"
  try {
    const regions = await regionModuleService.listRegions({}, { take: 1 })
    if (regions[0]) {
      regionId = regions[0].id
      currencyCode = regions[0].currency_code
    }
  } catch {
    // region module empty — fall back to currency only
  }

  const address = {
    first_name: "Aarav",
    last_name: "Sharma",
    address_1: "12 MG Road",
    address_2: "Sector 14",
    city: "Gurugram",
    province: "Haryana",
    postal_code: "122001",
    country_code: "in",
    phone: "9876543210",
  }

  logger.info("Seeding a test order...")

  const order = await orderModuleService.createOrders({
    region_id: regionId,
    currency_code: currencyCode,
    email: "aarav.sharma@example.com",
    shipping_address: address,
    billing_address: address,
    items: [
      {
        title: "Sterling Silver Solitaire Ring",
        subtitle: "925 Sterling Silver",
        quantity: 1,
        unit_price: 3999,
        metadata: { hsn_code: "7113", tax_rate: 3 },
      },
      {
        title: "Silver Jhumka Earrings",
        subtitle: "925 Sterling Silver",
        quantity: 2,
        unit_price: 1499,
        metadata: { hsn_code: "7113", tax_rate: 3 },
      },
      {
        title: "Silver Chain Bracelet",
        subtitle: "925 Sterling Silver",
        quantity: 1,
        unit_price: 2299,
        metadata: { hsn_code: "7113", tax_rate: 3 },
      },
    ],
  })

  const created = Array.isArray(order) ? order[0] : order

  logger.info("Order seeded successfully.")
  logger.info(`  Order ID:   ${created.id}`)
  logger.info(`  Display ID: #${created.display_id}`)
  logger.info(
    `  Invoice:    http://localhost:9000/admin/orders/${created.id}/invoice`
  )
  logger.info("  Open the invoice URL while logged into the admin dashboard.")
}
