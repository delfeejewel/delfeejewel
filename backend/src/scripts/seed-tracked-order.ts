import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Seeds a fully shipped order for the dummy customer so the order-tracking
 * page can be viewed with real fulfillment + courier data.
 *
 * Run with: npm run seed:tracked-order
 */

const EMAIL = "aarav.sharma@example.com"

export default async function seedTrackedOrder({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orderModule = container.resolve(Modules.ORDER)
  const customerModule = container.resolve(Modules.CUSTOMER)
  const regionModule = container.resolve(Modules.REGION)
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)

  // ── customer ──
  const customers = await customerModule.listCustomers({ email: EMAIL })
  const customerId = customers[0]?.id
  if (!customerId) {
    logger.error(`Customer ${EMAIL} not found. Run "npm run seed:customer" first.`)
    return
  }

  // ── region + stock location ──
  const regions = await regionModule.listRegions({}, { take: 1 })
  const region = regions[0]
  const locations = await stockLocationModule
    .listStockLocations({}, { take: 1 })
    .catch(() => [])
  const locationId = locations[0]?.id

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

  // ── create the order ──
  const order = await orderModule.createOrders({
    region_id: region?.id,
    currency_code: region?.currency_code || "inr",
    email: EMAIL,
    customer_id: customerId,
    shipping_address: address,
    billing_address: address,
    items: [
      {
        title: "Sterling Silver Solitaire Ring",
        subtitle: "925 Sterling Silver",
        quantity: 1,
        unit_price: 3999,
        metadata: { hsn_code: "7113" },
      },
      {
        title: "Silver Jhumka Earrings",
        subtitle: "925 Sterling Silver",
        quantity: 1,
        unit_price: 1499,
        metadata: { hsn_code: "7113" },
      },
    ],
    shipping_methods: [{ name: "Express Shipping", amount: 0 }],
  })
  const created = Array.isArray(order) ? order[0] : order
  logger.info(`Order created: #${created.display_id} (${created.id})`)

  // ── fulfill ──
  const { result: fulfillment } = await createOrderFulfillmentWorkflow(
    container
  ).run({
    input: {
      order_id: created.id,
      location_id: locationId,
      items: (created.items || []).map((i: any) => ({
        id: i.id,
        quantity: i.quantity,
      })),
    },
  })
  const fulfillmentId = (fulfillment as any).id
  logger.info(`Fulfillment created: ${fulfillmentId}`)

  // ── ship (with tracking label) ──
  await createOrderShipmentWorkflow(container).run({
    input: {
      order_id: created.id,
      fulfillment_id: fulfillmentId,
      labels: [
        {
          tracking_number: "BD9872100456IN",
          tracking_url:
            "https://www.shiprocket.in/tracking/BD9872100456IN",
          label_url: "",
        },
      ],
    } as any,
  })
  logger.info("Order marked as shipped.")

  // ── attach courier name onto the fulfillment data ──
  try {
    await fulfillmentModule.updateFulfillment(fulfillmentId, {
      data: { courier_name: "Blue Dart", awb_code: "BD9872100456IN" },
    })
    logger.info("Courier info attached.")
  } catch (e: any) {
    logger.warn(`Could not attach courier data: ${e.message}`)
  }

  logger.info("──────────────────────────────────────────────")
  logger.info("Tracked order ready.")
  logger.info(`  Order:   #${created.display_id}`)
  logger.info(`  Track:   /account/orders/details/${created.id}`)
  logger.info(`  Log in:  ${EMAIL} / Password123`)
  logger.info("──────────────────────────────────────────────")
}
