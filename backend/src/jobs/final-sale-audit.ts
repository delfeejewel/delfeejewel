import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { NON_RETURNABLE_CATEGORY_HANDLES } from "../lib/non-returnable"

/**
 * Keeps final-sale products (Coins) protected from discounts.
 *
 * `product.discountable = false` is what stops any promotion — including
 * coupons created later in the admin — from reducing a coin's price. Nothing
 * enforces it once set, so a single toggle in the admin, a careless import or a
 * restore from backup would quietly put bullion on sale at 15% off.
 *
 * This repairs rather than merely reports: leaving a coin discountable
 * overnight costs real money, and the correct value is never in doubt.
 *
 * Also flags any coin carrying an MRP/compare-at price. That one is only
 * reported, never changed — it renders a "Save X%" badge (misleading on a
 * final-sale item) but the fix belongs in the product data, and silently
 * deleting a price the client set would be worse than saying so.
 *
 * Runs daily, an hour after the low-stock job.
 */
export default async function finalSaleAuditJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModule: any = container.resolve(Modules.PRODUCT)

  try {
    const { data } = await query.graph({
      entity: "product",
      filters: {
        categories: { handle: NON_RETURNABLE_CATEGORY_HANDLES },
      } as any,
      fields: ["id", "title", "handle", "discountable", "variants.metadata"],
    })

    const products = (data as any[]) || []
    if (!products.length) {
      logger.info("Final-sale audit: no products in the final-sale categories.")
      return
    }

    const unprotected = products.filter((p) => p.discountable !== false)
    for (const p of unprotected) {
      await productModule.updateProducts(p.id, { discountable: false })
      logger.warn(
        `Final-sale audit: "${p.title}" (${p.handle}) was discountable — ` +
          `REPAIRED. Something re-enabled discounts on a final-sale product.`
      )
    }

    const withMrp = products.filter((p) =>
      (p.variants || []).some((v: any) => {
        const raw = v?.metadata?.compare_at_price ?? v?.metadata?.mrp
        return raw !== undefined && raw !== null && String(raw).trim() !== ""
      })
    )
    for (const p of withMrp) {
      logger.warn(
        `Final-sale audit: "${p.title}" (${p.handle}) has an MRP/compare-at ` +
          `price and will render a "Save X%" badge. Fix it in the product data.`
      )
    }

    logger.info(
      `Final-sale audit: ${products.length} product(s) checked, ` +
        `${unprotected.length} repaired, ${withMrp.length} with an MRP to fix.`
    )
  } catch (e: any) {
    logger.error(`Final-sale audit failed: ${e?.message}`)
  }
}

export const config = {
  name: "final-sale-audit",
  schedule: "0 10 * * *", // every day at 10 AM
}
