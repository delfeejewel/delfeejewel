import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Backfills `product.material`, which the PDP purity badge reads.
 *
 * The badge used to be the hardcoded string "925 Sterling" on every product —
 * wrong for the 999 fine silver coins. It now reads the product's own material,
 * and hides itself when no purity can be read. That makes `material` load-
 * bearing, and 275 of 331 live products carry the placeholder "N/A".
 *
 * Rules, in order:
 *   1. Products in "Coins"                → "999 Fine Silver"
 *   2. Service products (gift wrap, COD)  → skipped, they are not jewellery
 *   3. Known exceptions (see EXCEPTIONS)  → their real material
 *   4. Anything else still "N/A"/empty    → "925 Sterling Silver"
 *
 * Descriptive materials already set (e.g. "925 Sterling Silver with white
 * cubic zirconia (rhodium-plated)") are LEFT ALONE — they are richer than
 * anything this script would write, and the badge parses the purity out of them.
 *
 * Idempotent. Run: npx medusa exec ./src/scripts/seed-product-materials.ts
 */

const COINS_MATERIAL = "999 Fine Silver"
const DEFAULT_MATERIAL = "925 Sterling Silver"

/** Not jewellery — no purity claim belongs on them. */
const SKIP_HANDLES = ["gift-wrap", "cod-fee"]

/**
 * Products that are NOT sterling silver. Blanket-defaulting these to 925 would
 * put a false purity claim on the page, which is the exact bug being fixed.
 * Sourced from Products/products-data.md.
 */
const EXCEPTIONS: Record<string, string> = {
  "multi-gemstone-bead-necklace": "Natural Multi-Colour Gemstone Beads",
}

const isUnset = (m?: string | null) =>
  !m || !m.trim() || m.trim().toUpperCase() === "N/A"

export default async function seedProductMaterials({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModule: any = container.resolve(Modules.PRODUCT)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "material", "categories.handle"],
  })

  let coins = 0
  let defaulted = 0
  let exceptions = 0
  let skipped = 0
  let kept = 0

  for (const p of (products as any[]) || []) {
    const handle = p.handle || ""

    if (SKIP_HANDLES.includes(handle)) {
      skipped++
      continue
    }

    const inCoins = (p.categories || []).some((c: any) => c.handle === "coins")

    let target: string | null = null

    if (inCoins) {
      // Coins are always restated, not just filled in: an inherited "925"
      // from an earlier import would be a false purity claim on bullion.
      if (p.material !== COINS_MATERIAL) target = COINS_MATERIAL
      else kept++
    } else if (EXCEPTIONS[handle]) {
      if (p.material !== EXCEPTIONS[handle]) target = EXCEPTIONS[handle]
      else kept++
    } else if (isUnset(p.material)) {
      target = DEFAULT_MATERIAL
    } else {
      // Already has a real, descriptive material — richer than our default.
      kept++
    }

    if (!target) continue

    await productModule.updateProducts(p.id, { material: target })

    if (inCoins) coins++
    else if (EXCEPTIONS[handle]) exceptions++
    else defaulted++
  }

  logger.info(
    `Materials: ${coins} coin(s) → "${COINS_MATERIAL}", ` +
      `${defaulted} → "${DEFAULT_MATERIAL}", ` +
      `${exceptions} exception(s) corrected, ` +
      `${kept} left as-is, ${skipped} service product(s) skipped.`
  )
}
