import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Prints carts that the /cart/recover/[id] page can render:
 *   - has items
 *   - has email (optional)
 *   - not completed
 *
 * Sorted newest-updated first. Outputs the full deep-link URL so you can
 * copy/paste into a browser.
 *
 * Run: npx medusa exec src/scripts/find-recoverable-cart.ts
 */
export default async function findRecoverableCart({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const storefront =
    process.env.STOREFRONT_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:8000"
  const region = process.env.NEXT_PUBLIC_DEFAULT_REGION || "in"

  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "email",
      "currency_code",
      "total",
      "updated_at",
      "completed_at",
      "items.id",
    ],
  })

  const recoverable = ((carts as any[]) || [])
    .filter(
      (c) => !c.completed_at && (c.items?.length || 0) > 0
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() -
        new Date(a.updated_at).getTime()
    )

  if (!recoverable.length) {
    logger.warn(
      "No recoverable carts found. Add an item to cart on the storefront, then re-run."
    )
    return
  }

  logger.info(`Found ${recoverable.length} recoverable cart(s):`)
  console.log("")
  for (const c of recoverable.slice(0, 5)) {
    console.log(`  id:         ${c.id}`)
    console.log(`  email:      ${c.email || "(guest)"}`)
    console.log(`  items:      ${c.items?.length || 0}`)
    console.log(`  total:      ${c.total || 0} ${c.currency_code || ""}`)
    console.log(`  updated_at: ${c.updated_at}`)
    console.log(`  URL:        ${storefront}/${region}/cart/recover/${c.id}`)
    console.log("")
  }
}
