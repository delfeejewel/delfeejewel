import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Seeds a single fully-detailed showcase product with:
 * - Multiple images (gallery)
 * - Rich metadata (dimensions, purity, finish, weight, care)
 * - Multiple options (Color + Size)
 * - Multiple variants with prices
 * - Description, material, origin_country, weight
 * - Category & sales channel assignment
 *
 * Run: npx medusa exec src/scripts/seed-showcase-product.ts
 */
export default async function seedShowcaseProduct({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const productService = container.resolve(Modules.PRODUCT)

  logger.info("🌱 Seeding showcase product...")

  // ─── Resolve dependencies ────────────────────────────
  const [defaultSalesChannel] = await salesChannelService.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!defaultSalesChannel) {
    logger.error("No default sales channel found. Run main seed first.")
    return
  }

  const [shippingProfile] = await fulfillmentService.listShippingProfiles({
    type: "default",
  })
  if (!shippingProfile) {
    logger.error("No default shipping profile found. Run main seed first.")
    return
  }

  // Find the "Rings" category (or use first available)
  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle"],
  })
  const ringsCategory = categories.find((c: any) => c.handle === "rings")
  const categoryId = ringsCategory?.id || categories[0]?.id

  // Check if product already exists
  const existingProducts = await productService.listProducts({
    handle: "celestial-moonstone-silver-ring",
  })
  if (existingProducts.length) {
    logger.info("Showcase product already exists. Skipping.")
    return
  }

  // ─── Product images (Pexels free jewellery images) ───
  const images = [
    { url: "https://images.pexels.com/photos/10983783/pexels-photo-10983783.jpeg?auto=compress&cs=tinysrgb&w=1200" },
    { url: "https://images.pexels.com/photos/8891776/pexels-photo-8891776.jpeg?auto=compress&cs=tinysrgb&w=1200" },
    { url: "https://images.pexels.com/photos/12456862/pexels-photo-12456862.jpeg?auto=compress&cs=tinysrgb&w=1200" },
    { url: "https://images.pexels.com/photos/10470506/pexels-photo-10470506.jpeg?auto=compress&cs=tinysrgb&w=1200" },
    { url: "https://images.pexels.com/photos/13422018/pexels-photo-13422018.jpeg?auto=compress&cs=tinysrgb&w=1200" },
    { url: "https://images.pexels.com/photos/15525659/pexels-photo-15525659.jpeg?auto=compress&cs=tinysrgb&w=1200" },
  ]

  // ─── Create the product ──────────────────────────────
  const { result: productResult } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "celestial moonstone silver ring",
          handle: "celestial-moonstone-silver-ring",
          status: ProductStatus.PUBLISHED,
          description:
            "Inspired by the ethereal glow of moonlight, the Celestial Moonstone Ring features a genuine rainbow moonstone cabochon set in a handcrafted 925 sterling silver bezel. The band showcases delicate filigree work reminiscent of vintage Art Deco jewellery, with tiny silver granules forming a crescent moon motif on each shoulder. Every ring is individually crafted by master artisans in Jaipur, ensuring that no two pieces are exactly alike. The moonstone displays a captivating adularescence — a soft, billowing light that moves across the surface as the stone is turned. This mesmerising optical effect, combined with the warm patina of hand-finished silver, makes this ring a true heirloom piece. Whether worn as an everyday statement or reserved for special occasions, the Celestial Moonstone Ring bridges tradition and contemporary elegance.",
          material: "925 Sterling Silver",
          weight: 7,
          origin_country: "IN",
          thumbnail: images[0].url,
          images,
          metadata: {
            metal: "925 Sterling Silver",
            purity: "92.5%",
            finish: "Oxidised Antique with High-Polish Bezel",
            dimensions: "Band Width: 3mm | Stone: 10×8mm Oval",
            gemstone: "Natural Rainbow Moonstone",
            gemstone_origin: "Sri Lanka",
            care_instructions:
              "Store in the provided anti-tarnish pouch. Avoid contact with perfumes, lotions, and water. Clean gently with a soft silver polishing cloth.",
            hallmark: "BIS 925 Hallmarked",
            packaging: "Luxury velvet box with certificate of authenticity",
            warranty: "6-month manufacturing warranty",
            return_policy: "15-day easy returns",
          },
          ...(categoryId ? { category_ids: [categoryId] } : {}),
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Color",
              values: ["Silver", "Rose Gold", "Oxidized Silver"],
            },
            {
              title: "Size",
              values: ["6", "7", "8", "9"],
            },
          ],
          variants: [
            // Silver variants
            {
              title: "Silver / Size 6",
              sku: "DF-MOON-SIL-6",
              options: { Color: "Silver", Size: "6" },
              manage_inventory: true,
              prices: [{ amount: 3499, currency_code: "inr" }],
            },
            {
              title: "Silver / Size 7",
              sku: "DF-MOON-SIL-7",
              options: { Color: "Silver", Size: "7" },
              manage_inventory: true,
              prices: [{ amount: 3499, currency_code: "inr" }],
            },
            {
              title: "Silver / Size 8",
              sku: "DF-MOON-SIL-8",
              options: { Color: "Silver", Size: "8" },
              manage_inventory: true,
              prices: [{ amount: 3499, currency_code: "inr" }],
            },
            {
              title: "Silver / Size 9",
              sku: "DF-MOON-SIL-9",
              options: { Color: "Silver", Size: "9" },
              manage_inventory: true,
              prices: [{ amount: 3499, currency_code: "inr" }],
            },
            // Rose Gold variants
            {
              title: "Rose Gold / Size 6",
              sku: "DF-MOON-RG-6",
              options: { Color: "Rose Gold", Size: "6" },
              manage_inventory: true,
              prices: [{ amount: 4299, currency_code: "inr" }],
            },
            {
              title: "Rose Gold / Size 7",
              sku: "DF-MOON-RG-7",
              options: { Color: "Rose Gold", Size: "7" },
              manage_inventory: true,
              prices: [{ amount: 4299, currency_code: "inr" }],
            },
            {
              title: "Rose Gold / Size 8",
              sku: "DF-MOON-RG-8",
              options: { Color: "Rose Gold", Size: "8" },
              manage_inventory: true,
              prices: [{ amount: 4299, currency_code: "inr" }],
            },
            {
              title: "Rose Gold / Size 9",
              sku: "DF-MOON-RG-9",
              options: { Color: "Rose Gold", Size: "9" },
              manage_inventory: true,
              prices: [{ amount: 4299, currency_code: "inr" }],
            },
            // Oxidized Silver variants
            {
              title: "Oxidized Silver / Size 6",
              sku: "DF-MOON-OX-6",
              options: { Color: "Oxidized Silver", Size: "6" },
              manage_inventory: true,
              prices: [{ amount: 3799, currency_code: "inr" }],
            },
            {
              title: "Oxidized Silver / Size 7",
              sku: "DF-MOON-OX-7",
              options: { Color: "Oxidized Silver", Size: "7" },
              manage_inventory: true,
              prices: [{ amount: 3799, currency_code: "inr" }],
            },
            {
              title: "Oxidized Silver / Size 8",
              sku: "DF-MOON-OX-8",
              options: { Color: "Oxidized Silver", Size: "8" },
              manage_inventory: true,
              prices: [{ amount: 3799, currency_code: "inr" }],
            },
            {
              title: "Oxidized Silver / Size 9",
              sku: "DF-MOON-OX-9",
              options: { Color: "Oxidized Silver", Size: "9" },
              manage_inventory: true,
              prices: [{ amount: 3799, currency_code: "inr" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
      ],
    },
  })

  logger.info(`✅ Created product: ${productResult[0].title} (${productResult[0].handle})`)

  // ─── Set inventory levels ────────────────────────────
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: {
      sku: { $like: "DF-MOON-%" },
    },
  })

  // Get stock location
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id"],
  })
  const stockLocationId = stockLocations[0]?.id

  if (stockLocationId && inventoryItems.length) {
    const inventoryLevels: CreateInventoryLevelInput[] = inventoryItems.map(
      (item: any) => ({
        inventory_item_id: item.id,
        location_id: stockLocationId,
        stocked_quantity: 50,
      })
    )

    await createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: inventoryLevels },
    })

    logger.info(`✅ Set inventory for ${inventoryItems.length} variants (50 units each)`)
  }

  logger.info("🎉 Showcase product seeded successfully!")
  logger.info("   View at: http://localhost:8000/in/products/celestial-moonstone-silver-ring")
}
