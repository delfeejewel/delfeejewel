import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

/**
 * Seeds sample product collections so the /collections/[handle] page has
 * something to render. Idempotent — finds by handle, upserts metadata,
 * assigns products by simple metadata rules.
 *
 * Run: npx medusa exec src/scripts/seed-collections.ts
 */

type CollectionSeed = {
  handle: string
  title: string
  tagline: string
  pickProducts: (
    products: any[]
  ) => any[]
}

const COLLECTION_SEEDS: CollectionSeed[] = [
  {
    handle: "new-arrivals",
    title: "New Arrivals",
    tagline: "Fresh off the bench — the latest pieces, while they last.",
    pickProducts: (products) =>
      [...products]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        )
        .slice(0, 8),
  },
  {
    handle: "best-sellers",
    title: "Bestsellers",
    tagline: "The ones everyone's wearing — designs that keep selling out.",
    pickProducts: (products) => {
      // Tagged via metadata if available, otherwise a stable subset.
      const tagged = products.filter(
        (p) =>
          (p.metadata as any)?.badge === "bestseller" ||
          (p.metadata as any)?.collection === "best-seller"
      )
      if (tagged.length >= 4) return tagged.slice(0, 8)
      return products.slice(0, 8)
    },
  },
  {
    handle: "bridal-edit",
    title: "Bridal Edit",
    tagline:
      "For the most-photographed day — timeless pieces, hand-finished.",
    pickProducts: (products) => {
      const tagged = products.filter((p) => {
        const meta = (p.metadata as any) || {}
        return (
          meta.occasion === "bridal-wedding" ||
          meta.collection === "bridal" ||
          /bridal/i.test(p.title || "")
        )
      })
      return tagged.slice(0, 8)
    },
  },
  {
    handle: "anti-tarnish",
    title: "Anti-Tarnish Edit",
    tagline:
      "Daily-wear staples treated to last — no polishing, no fading.",
    pickProducts: (products) =>
      products
        .filter((p) => (p.metadata as any)?.care === "anti-tarnish")
        .slice(0, 8),
  },
  {
    handle: "under-2000",
    title: "Under ₹2,000",
    tagline: "Easy gifts and self-buys — beautifully under budget.",
    pickProducts: (products) =>
      products
        .filter((p) => {
          const price = p.variants?.[0]?.calculated_price?.calculated_amount
          return typeof price === "number" && price > 0 && price <= 2000
        })
        .slice(0, 8),
  },
]

export default async function seedCollections({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productService: any = container.resolve(Modules.PRODUCT)

  logger.info("🪻 Seeding product collections…")

  // Fetch all products (for assignment rules). Pull rich fields so
  // metadata-based pickers + variants work.
  const allProducts = await productService.listProducts(
    {},
    { take: 1000, relations: ["variants"] }
  )
  logger.info(`Found ${allProducts.length} product(s) to assign from.`)

  for (const seed of COLLECTION_SEEDS) {
    // 1. Upsert the collection itself (idempotent by handle).
    let collection: any
    const existing = await productService.listProductCollections({
      handle: seed.handle,
    })
    if (existing?.length) {
      const updated = await productService.updateProductCollections(
        { id: existing[0].id },
        {
          title: seed.title,
          metadata: { ...(existing[0].metadata || {}), tagline: seed.tagline },
        }
      )
      collection = Array.isArray(updated) ? updated[0] : updated
      logger.info(`  ↻ updated "${seed.title}" (${collection.id})`)
    } else {
      ;[collection] = await productService.createProductCollections([
        {
          handle: seed.handle,
          title: seed.title,
          metadata: { tagline: seed.tagline },
        },
      ])
      logger.info(`  + created "${seed.title}" (${collection.id})`)
    }

    // 2. Pick products + assign them to this collection.
    const picked = seed.pickProducts(allProducts)
    if (!picked.length) {
      logger.info(`    no matching products for "${seed.title}" — skipping assignment`)
      continue
    }

    await productService.updateProducts(
      { id: picked.map((p) => p.id) },
      { collection_id: collection.id }
    )
    logger.info(`    assigned ${picked.length} product(s) to "${seed.title}"`)
  }

  logger.info("✅ Collections seed complete.")
}
