import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows"
import { REVIEW_MODULE } from "../modules/review"

/**
 * Seeds a complete demo account: one customer who can log in, plus three
 * orders showing the full lifecycle, with line items properly linked to
 * real products and one delivered order that has a review.
 *
 * Run with: npm run seed:demo
 * (Run `npx medusa exec ./src/scripts/cleanup-data.ts` first for a clean slate.)
 */

const EMAIL = "demo@delfee.com"
const PASSWORD = "Demo@12345"
const FIRST = "Aanya"
const LAST = "Verma"

export default async function seedDemoAccount({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const authModule = container.resolve(Modules.AUTH)
  const customerModule = container.resolve(Modules.CUSTOMER)
  const orderModule: any = container.resolve(Modules.ORDER)
  const regionModule = container.resolve(Modules.REGION)
  const reviewModule: any = container.resolve(REVIEW_MODULE)

  // ── Region / currency ───────────────────────────────
  let regionId: string | undefined
  let currencyCode = "inr"
  const regions = await regionModule.listRegions({}, { take: 1 })
  if (regions[0]) {
    regionId = regions[0].id
    currencyCode = regions[0].currency_code
  }

  // ── Products ────────────────────────────────────────
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "thumbnail", "variants.id"],
  })
  if (!products || products.length === 0) {
    logger.error("No products in the catalog — seed products first.")
    return
  }

  const mainProduct =
    products.find((p: any) => !/^test$/i.test((p.title || "").trim())) ||
    products[0]
  const otherProduct =
    products.find((p: any) => p.id !== mainProduct.id) || mainProduct

  const lineItem = (p: any, quantity: number, unit_price: number) => ({
    product_id: p.id,
    variant_id: p.variants?.[0]?.id,
    product_title: p.title,
    product_handle: p.handle,
    title: p.title,
    subtitle: "925 Sterling Silver",
    thumbnail: p.thumbnail || undefined,
    quantity,
    unit_price,
    metadata: { hsn_code: "7113", tax_rate: 3 },
  })

  // ── Customer (loginable) ────────────────────────────
  let customerId: string
  const existing = await customerModule.listCustomers({ email: EMAIL })
  if (existing.length > 0) {
    customerId = existing[0].id
    logger.info(`Customer already exists — reusing ${EMAIL}`)
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
          first_name: FIRST,
          last_name: LAST,
          phone: "9811122233",
        },
      },
    })
    customerId = result.id
    logger.info(`Customer created: ${EMAIL}`)
  }

  const address = {
    first_name: FIRST,
    last_name: LAST,
    address_1: "21 Banjara Hills",
    address_2: "Road No. 12",
    city: "Hyderabad",
    province: "Telangana",
    postal_code: "500034",
    country_code: "in",
    phone: "9811122233",
  }

  const makeOrder = async (items: any[]) => {
    const created = await orderModule.createOrders({
      region_id: regionId,
      currency_code: currencyCode,
      email: EMAIL,
      shipping_address: address,
      billing_address: address,
      items,
    })
    return Array.isArray(created) ? created[0] : created
  }

  // ── Order 1 — delivered (eligible for reviews) ──────
  const order1 = await makeOrder([
    lineItem(mainProduct, 1, 3499),
    lineItem(otherProduct, 1, 1999),
  ])
  const deliveredAt = new Date(Date.now() - 4 * 86400_000).toISOString()
  await orderModule.updateOrders(order1.id, {
    customer_id: customerId,
    metadata: {
      delivered_at: deliveredAt,
      shiprocket_status: "Delivered",
      awb: "DEMOAWB1001",
    },
  })

  // ── Order 2 — shipped / in transit ──────────────────
  const order2 = await makeOrder([lineItem(mainProduct, 1, 3499)])
  await orderModule.updateOrders(order2.id, {
    customer_id: customerId,
    metadata: { shiprocket_status: "In Transit", awb: "DEMOAWB1002" },
  })

  // ── Order 3 — processing ────────────────────────────
  const order3 = await makeOrder([lineItem(otherProduct, 2, 1999)])
  await orderModule.updateOrders(order3.id, { customer_id: customerId })

  // Note: an order's fulfillment_status is derived by Medusa from real
  // fulfillment records — it cannot be set directly. The delivered state is
  // carried in order #1's metadata (delivered_at + shiprocket_status), which
  // is what review eligibility and Shiprocket-based tracking use.

  // ── Review — mainProduct from the delivered order ───
  await reviewModule.createProductReviews({
    customer_id: customerId,
    customer_name: `${FIRST} ${LAST[0]}.`,
    product_id: mainProduct.id,
    order_id: order1.id,
    rating: 5,
    content:
      "Absolutely stunning piece — the finish is flawless and it arrived beautifully packaged. Looks even better in person.",
    status: "approved",
  })

  // ── Summary ─────────────────────────────────────────
  logger.info("──────────────────────────────────────────────")
  logger.info("Demo account seeded:")
  logger.info(`  Email:    ${EMAIL}`)
  logger.info(`  Password: ${PASSWORD}`)
  logger.info(`  Order #${order1.display_id} — delivered (reviewed: ${mainProduct.title})`)
  logger.info(`  Order #${order2.display_id} — shipped`)
  logger.info(`  Order #${order3.display_id} — processing`)
  logger.info(`  Pending review: ${otherProduct.title}`)
  logger.info("  Storefront: http://localhost:8000/account")
  logger.info("──────────────────────────────────────────────")
}
