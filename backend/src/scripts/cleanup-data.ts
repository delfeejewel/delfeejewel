import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { REVIEW_MODULE } from "../modules/review"
import { WISHLIST_MODULE } from "../modules/wishlist"

export default async function cleanupData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    // Delete all orders
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id"],
    })

    if (orders?.length) {
      const orderModule = container.resolve(Modules.ORDER)
      for (const order of orders) {
        try {
          await orderModule.deleteOrders([order.id])
          logger.info(`Deleted order #${(order as any).display_id}`)
        } catch (e: any) {
          logger.warn(`Could not delete order #${(order as any).display_id}: ${e.message}`)
        }
      }
    } else {
      logger.info("No orders found")
    }

    // Delete all customers
    const customerModule = container.resolve(Modules.CUSTOMER)
    const customers = await customerModule.listCustomers()

    if (customers?.length) {
      for (const customer of customers) {
        try {
          await customerModule.deleteCustomers([(customer as any).id])
          logger.info(`Deleted customer: ${(customer as any).email}`)
        } catch (e: any) {
          logger.warn(`Could not delete customer ${(customer as any).email}: ${e.message}`)
        }
      }
    } else {
      logger.info("No customers found")
    }

    // Delete customer auth identities (so the emails can be re-registered).
    // Only customer logins — admin user identities are left untouched.
    try {
      const authModule: any = container.resolve(Modules.AUTH)
      const identities = await authModule.listAuthIdentities()
      const customerIdentities = (identities || []).filter(
        (a: any) => a?.app_metadata?.customer_id
      )
      if (customerIdentities.length) {
        await authModule.deleteAuthIdentities(
          customerIdentities.map((a: any) => a.id)
        )
        logger.info(
          `Deleted ${customerIdentities.length} customer auth identities`
        )
      }
    } catch (e: any) {
      logger.warn(`Could not delete auth identities: ${e.message}`)
    }

    // Delete all carts
    const cartModule = container.resolve(Modules.CART)
    const carts = await cartModule.listCarts()

    if (carts?.length) {
      for (const cart of carts) {
        try {
          await cartModule.deleteCarts([(cart as any).id])
        } catch {}
      }
      logger.info(`Deleted ${carts.length} carts`)
    }

    // Delete all product reviews
    try {
      const reviewModule: any = container.resolve(REVIEW_MODULE)
      const reviews = await reviewModule.listProductReviews()
      if (reviews?.length) {
        await reviewModule.deleteProductReviews(reviews.map((r: any) => r.id))
        logger.info(`Deleted ${reviews.length} product reviews`)
      }
    } catch (e: any) {
      logger.warn(`Could not delete reviews: ${e.message}`)
    }

    // Delete all wishlist items
    try {
      const wishlistModule: any = container.resolve(WISHLIST_MODULE)
      const items = await wishlistModule.listWishlistItems()
      if (items?.length) {
        await wishlistModule.deleteWishlistItems(items.map((i: any) => i.id))
        logger.info(`Deleted ${items.length} wishlist items`)
      }
    } catch (e: any) {
      logger.warn(`Could not delete wishlist items: ${e.message}`)
    }

    logger.info("Cleanup complete")
  } catch (error: any) {
    logger.error(`Cleanup failed: ${error.message}`)
  }
}
