import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Creates the "Coins" category and enforces its two invariants:
 *
 *   1. Every product in it is `discountable: false`, so no promotion can ever
 *      reduce its price. This is enforced by Medusa's promotion engine itself
 *      for EVERY promotion — verified against a rule-free order-level coupon —
 *      so it holds for coupons created later in the admin by anyone.
 *   2. It is hidden from the homepage "Shop by Category" module via
 *      `metadata.hide_from_homepage`, while remaining in the main nav, footer
 *      and mobile menu (they read the unfiltered category list).
 *
 * Safe and idempotent: re-run it after every coin import as an audit. It only
 * ever flips `discountable` to false for products inside Coins, and reports
 * anything else it finds wrong (an MRP set on a coin) without changing it.
 *
 * Run: npx medusa exec ./src/scripts/seed-coins-category.ts
 */

const NAME = "Coins"
const HANDLE = "coins"

export default async function seedCoinsCategory({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModule: any = container.resolve(Modules.PRODUCT)

  // ---- 1. category ------------------------------------------------------
  const [existing] = await productModule.listProductCategories(
    { handle: HANDLE },
    { take: 1 }
  )

  let categoryId: string

  if (existing) {
    categoryId = existing.id
    await productModule.updateProductCategories(categoryId, {
      is_active: true,
      metadata: { ...(existing.metadata || {}), hide_from_homepage: true },
    })
    logger.info(`Coins category already exists (${categoryId}) — settings reapplied`)
  } else {
    // Rank last so it doesn't displace the jewellery categories in the nav.
    //
    // Two traps here, both hit while writing this:
    //  - rank is a MANAGED ordered list: inserting at rank N shifts every
    //    sibling at or after N down by one. Get it wrong and the whole nav
    //    reorders.
    //  - `listProductCategories` returns entities WITHOUT their scalar fields
    //    populated, so `c.rank` reads undefined and the max silently collapses
    //    to 0 → rank 1 → Coins lands second in the nav. Use query.graph, which
    //    returns the fields actually asked for.
    const { data: siblings } = await query.graph({
      entity: "product_category",
      fields: ["id", "rank"],
    })
    const rank =
      Math.max(
        0,
        ...(siblings as any[]).map((c) => Number(c.rank) || 0)
      ) + 1

    const created = await productModule.createProductCategories({
      name: NAME,
      handle: HANDLE,
      is_active: true,
      is_internal: false,
      rank,
      metadata: { hide_from_homepage: true },
    })
    categoryId = (Array.isArray(created) ? created[0] : created).id
    logger.info(`Created Coins category: ${categoryId} (rank ${rank})`)
  }

  // ---- 2. enforce discountable: false on its products --------------------
  const { data: products } = await query.graph({
    entity: "product",
    // `as any`: the generated filter type doesn't model nested relation filters
    // by id, so this fails the build without the cast (TS2322).
    filters: { categories: { id: categoryId } } as any,
    fields: ["id", "title", "handle", "discountable", "variants.metadata"],
  })

  const coins = (products as any[]) || []

  if (!coins.length) {
    logger.info("No products in Coins yet — nothing to enforce.")
    return
  }

  const needsFlag = coins.filter((p) => p.discountable !== false)

  for (const p of needsFlag) {
    await productModule.updateProducts(p.id, { discountable: false })
    logger.info(`Marked non-discountable: ${p.title} (${p.handle})`)
  }

  // A compare-at/MRP renders a struck-through price and a "Save X%" badge on
  // the storefront — a discount in the customer's eyes even though the charged
  // price is right. Report rather than edit: the correct fix is in the product
  // data, and silently deleting a price the client set would be worse.
  const withMrp = coins.filter((p) =>
    (p.variants || []).some((v: any) => {
      const raw = v?.metadata?.compare_at_price ?? v?.metadata?.mrp
      return raw !== undefined && raw !== null && String(raw).trim() !== ""
    })
  )

  for (const p of withMrp) {
    logger.warn(
      `${p.title} (${p.handle}) has an MRP/compare-at price. Coins must show a ` +
        `single price — the storefront will render a "Save X%" badge on it. ` +
        `Remove it from the product data.`
    )
  }

  logger.info(
    `Coins: ${coins.length} product(s); ${needsFlag.length} newly flagged; ` +
      `${coins.length - needsFlag.length} already correct; ${withMrp.length} with an MRP to fix.`
  )
}
