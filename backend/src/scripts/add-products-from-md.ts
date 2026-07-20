/**
 * Add products to the store from `Products/products-data.md`.
 *
 * Parses the md into structured product records, uploads each product's local
 * images + videos to Supabase Storage (bucket `product-media`), creates the
 * product (options/variants/prices/tags/type/category/sales-channel/metadata)
 * and sets inventory to the md quantity at the single stock location.
 *
 * Structurally mirrors the existing live products (verified against
 * peridot-crystal-bead-necklace / kite-solitaire-ring):
 *   - single "One size" products => default option/variant (no options passed)
 *   - metadata = { videos: [...supabase urls], gift_ready: true }
 *   - type resolved/created by value ("Necklace", "Anklet", ...)
 *   - category mapped md-name -> real backend category
 *   - images + thumbnail on Supabase, videos in metadata.videos
 *
 * Idempotent: a product whose handle already exists is skipped.
 *
 * Usage (run on the dev box that has the Products/ folder + images):
 *   npx medusa exec ./src/scripts/add-products-from-md.ts <Prod-74> [<Prod-75> ...]
 *   npx medusa exec ./src/scripts/add-products-from-md.ts all-missing   # every doc product not yet live
 */
import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { createClient } from "@supabase/supabase-js"
import { promises as fs } from "fs"
import path from "path"

const BUCKET = "product-media"
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
}

// md "Category:" value -> backend category handle
const CATEGORY_HANDLE: Record<string, string> = {
  Rings: "rings",
  Necklaces: "necklaces-pendants",
  "Necklaces & Pendants": "necklaces-pendants",
  Bracelets: "bracelets-bangles",
  "Bracelets & Bangles": "bracelets-bangles",
  Anklets: "anklets",
  Earrings: "earrings",
  Mangalsutras: "mangalsutras",
  Rakhi: "rakhi",
  Rakhis: "rakhi",
}

type Variant = { size: string; sku: string; price: number; weight: number }
type Parsed = {
  prodId: string // "Prod-74"
  folder: string // "Products/Necklaces/Prod-74" (relative to repo root)
  title: string
  handle: string
  subtitle?: string
  category: string
  type: string
  material: string
  tags: string[]
  description: string
  status: string
  thumbnail: string // filename
  gallery: string[] // filenames
  videos: string[] // filenames
  variants: Variant[]
}

function stripField(line: string): string {
  // "- **Title:** Foo" -> "Foo"
  return line.replace(/^-\s*\*\*[^:]+:\*\*\s*/, "").trim()
}
function backticks(s: string): string[] {
  return [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1])
}
// Filenames may be listed either as separate backtick groups (`1.png`, `2.jpeg`)
// or comma-joined inside a single group (`1.jpeg, 2.jpeg, 3.png`). Handle both.
function backtickFiles(s: string): string[] {
  return backticks(s)
    .flatMap((g) => g.split(","))
    .map((f) => f.trim())
    .filter(Boolean)
}
function toNumber(s: string): number {
  return parseFloat(s.replace(/,/g, "").replace(/[^\d.]/g, "")) || 0
}

function parseMd(md: string): Parsed[] {
  const lines = md.split("\n")
  const blocks: string[][] = []
  let cur: string[] | null = null
  for (const line of lines) {
    if (/^###\s+Prod-\d+/.test(line)) {
      if (cur) blocks.push(cur)
      cur = [line]
    } else if (cur) {
      cur.push(line)
    }
  }
  if (cur) blocks.push(cur)

  const out: Parsed[] = []
  for (const block of blocks) {
    const header = block[0]
    const prodId = (header.match(/Prod-\d+/) || [""])[0]
    const folder = (backticks(header)[0] || "").trim()
    const get = (label: string) =>
      block.find((l) => new RegExp(`^-\\s*\\*\\*${label}:\\*\\*`).test(l))

    const titleL = get("Title")
    const handleL = get("Handle")
    if (!titleL || !handleL) continue

    const tagsRaw = get("Tags") ? stripField(get("Tags")!) : ""
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)

    const thumbL = get("Thumbnail")
    const galleryL = get("Gallery images")
    const videoL = get("Video media")

    // variants table rows: | size | SKU | Price | Inventory | Weight |
    const variants: Variant[] = []
    for (const l of block) {
      const cells = l.split("|").map((c) => c.trim())
      // a data row has empty first+last cell and the 2nd cell is not a header/separator
      if (cells.length >= 6 && cells[0] === "" && cells[2] && /^[A-Z]+-/.test(cells[2])) {
        variants.push({
          size: cells[1],
          sku: cells[2],
          price: toNumber(cells[3]),
          weight: toNumber(cells[5]),
        })
      }
    }

    out.push({
      prodId,
      folder,
      title: stripField(titleL),
      handle: backticks(handleL)[0] || stripField(handleL),
      subtitle: get("Subtitle") ? stripField(get("Subtitle")!) : undefined,
      category: get("Category") ? stripField(get("Category")!) : "",
      type: get("Type") ? stripField(get("Type")!) : "",
      material: get("Material") ? stripField(get("Material")!) : "",
      tags,
      description: get("Description") ? stripField(get("Description")!) : "",
      status: get("Status") ? stripField(get("Status")!) : "Published",
      thumbnail: thumbL ? backtickFiles(thumbL)[0] || "" : "",
      gallery: galleryL ? backtickFiles(galleryL) : [],
      videos: videoL ? backtickFiles(videoL) : [],
      variants,
    })
  }
  return out
}

export default async function addProductsFromMd({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productService = container.resolve(Modules.PRODUCT)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)

  const args = process.argv.slice(process.argv.indexOf("add-products-from-md.ts") + 1)
  // `backfill`: repair media/category on products that already exist but are
  // missing gallery images (e.g. from an earlier comma-parsing bug), instead of
  // skipping them. New products are still created.
  const backfill = args.includes("backfill")
  const targets = args.filter((a) => /^Prod-\d+$/i.test(a) || a === "all-missing")
  if (!targets.length) {
    logger.error("Pass one or more Prod-XX ids, or `all-missing` (optionally `backfill`).")
    return
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // repo root = one level up from backend/
  const repoRoot = path.resolve(process.cwd(), "..")
  const mdPath = path.join(repoRoot, "Products", "products-data.md")
  const md = await fs.readFile(mdPath, "utf8")
  const all = parseMd(md)

  let selected: Parsed[]
  if (targets.includes("all-missing")) {
    selected = all
  } else {
    const want = new Set(targets.map((t) => t.toLowerCase()))
    selected = all.filter((p) => want.has(p.prodId.toLowerCase()))
  }
  if (!selected.length) {
    logger.error("No matching product blocks found in md.")
    return
  }

  // shared deps
  const [defaultSalesChannel] = await salesChannelService.listSalesChannels({
    name: "Default Sales Channel",
  })
  const [shippingProfile] = await fulfillmentService.listShippingProfiles({
    type: "default",
  })
  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle"],
  })
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const stockLocationId = stockLocations[0]?.id
  if (!defaultSalesChannel || !shippingProfile || !stockLocationId) {
    logger.error("Missing sales channel / shipping profile / stock location.")
    return
  }

  const resolveType = async (value: string): Promise<string | undefined> => {
    if (!value) return undefined
    const existing = await productService.listProductTypes({ value })
    if (existing?.[0]) return existing[0].id
    const created = await productService.createProductTypes([{ value }])
    return created[0].id
  }
  const resolveTagIds = async (values: string[]): Promise<string[]> => {
    const ids: string[] = []
    for (const value of values) {
      const existing = await productService.listProductTags({ value })
      if (existing?.[0]) ids.push(existing[0].id)
      else ids.push((await productService.createProductTags([{ value }]))[0].id)
    }
    return ids
  }
  const uploadFile = async (
    absPath: string,
    prodId: string,
    filename: string
  ): Promise<string | null> => {
    try {
      const buf = await fs.readFile(absPath)
      const ext = path.extname(filename).toLowerCase()
      const contentType = CONTENT_TYPES[ext] || "application/octet-stream"
      const base = path
        .basename(filename, ext)
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
      const objectPath = `${prodId.toLowerCase()}-${base}-${buf.length}${ext}`
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, buf, { contentType, upsert: true })
      if (error && !/already exists/i.test(error.message)) throw error
      return supabase.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl
    } catch (e: any) {
      logger.warn(`  upload failed for ${filename}: ${e.message}`)
      return null
    }
  }

  for (const p of selected) {
    logger.info(`\n=== ${p.prodId}: ${p.title} (${p.handle}) ===`)

    // Mangalsutras are filed under "Necklaces" in the md but have their own
    // backend category — route them there for discoverability/filtering.
    const isMangalsutra =
      p.handle.includes("mangalsutra") || p.tags.includes("mangalsutra")
    const catHandle = isMangalsutra ? "mangalsutras" : CATEGORY_HANDLE[p.category]
    const category = categories.find((c: any) => c.handle === catHandle)
    if (!category) {
      logger.warn(`  category "${p.category}" (-> ${catHandle}) not found; importing without category.`)
    }

    const absDir = path.join(repoRoot, p.folder)

    // desired gallery = thumbnail first, then the rest, de-duped, order preserved
    const galleryOrder = [p.thumbnail, ...p.gallery].filter(
      (f, i, arr) => f && arr.indexOf(f) === i
    )

    const existing = await productService.listProducts({ handle: p.handle })
    if (existing.length) {
      if (!backfill) {
        logger.info("  already exists — skipping.")
        continue
      }
      // Backfill: repair a live product that is missing its gallery/category.
      const { data: liveRows } = await query.graph({
        entity: "product",
        fields: ["id", "metadata", "images.url", "categories.id"],
        filters: { handle: p.handle },
      })
      const live: any = liveRows[0]
      const liveImageCount = live?.images?.length ?? 0
      const hasCategory = (live?.categories?.length ?? 0) > 0
      const needsImages = liveImageCount < galleryOrder.length
      const needsCategory = !!category && !hasCategory
      if (!needsImages && !needsCategory) {
        logger.info("  already complete — skipping.")
        continue
      }

      const bfImageUrls: string[] = []
      let bfThumb: string | undefined
      if (needsImages) {
        for (const f of galleryOrder) {
          const url = await uploadFile(path.join(absDir, f), p.prodId, f)
          if (url) {
            bfImageUrls.push(url)
            if (f === p.thumbnail && !bfThumb) bfThumb = url
          }
        }
        if (!bfThumb && bfImageUrls[0]) bfThumb = bfImageUrls[0]
      }
      const bfVideoUrls: string[] = []
      if (needsImages) {
        for (const f of p.videos) {
          const url = await uploadFile(path.join(absDir, f), p.prodId, f)
          if (url) bfVideoUrls.push(url)
        }
      }

      const update: any = { id: live.id }
      if (needsImages && bfImageUrls.length) {
        update.images = bfImageUrls.map((url) => ({ url }))
        update.thumbnail = bfThumb
        update.metadata = {
          ...(live.metadata || {}),
          ...(bfVideoUrls.length ? { videos: bfVideoUrls } : {}),
          gift_ready: true,
        }
      }
      if (needsCategory) update.category_ids = [category!.id]

      await updateProductsWorkflow(container).run({ input: { products: [update] } })
      logger.info(
        `  backfilled: ${needsImages ? `${bfImageUrls.length} images` : "images ok"}` +
          `${needsCategory ? `, category ${catHandle}` : ""}`
      )
      continue
    }

    // upload gallery (thumbnail first so it leads), de-duped, order preserved
    const imageUrls: string[] = []
    let thumbnailUrl: string | undefined
    for (const f of galleryOrder) {
      const url = await uploadFile(path.join(absDir, f), p.prodId, f)
      if (url) {
        imageUrls.push(url)
        if (f === p.thumbnail && !thumbnailUrl) thumbnailUrl = url
      }
    }
    if (!thumbnailUrl && imageUrls[0]) thumbnailUrl = imageUrls[0]

    // upload videos
    const videoUrls: string[] = []
    for (const f of p.videos) {
      const url = await uploadFile(path.join(absDir, f), p.prodId, f)
      if (url) videoUrls.push(url)
    }

    const typeId = await resolveType(p.type)
    const tagIds = await resolveTagIds(p.tags)
    const status =
      p.status.toLowerCase() === "draft" ? ProductStatus.DRAFT : ProductStatus.PUBLISHED

    const sized = p.variants.length > 1
    const productInput: any = {
      title: p.title,
      handle: p.handle,
      subtitle: p.subtitle,
      status,
      description: p.description,
      material: p.material,
      weight: p.variants[0]?.weight || undefined,
      thumbnail: thumbnailUrl,
      images: imageUrls.map((url) => ({ url })),
      metadata: {
        ...(videoUrls.length ? { videos: videoUrls } : {}),
        gift_ready: true,
      },
      ...(category ? { category_ids: [category.id] } : {}),
      ...(typeId ? { type_id: typeId } : {}),
      ...(tagIds.length ? { tags: tagIds.map((id) => ({ id })) } : {}),
      shipping_profile_id: shippingProfile.id,
      sales_channels: [{ id: defaultSalesChannel.id }],
    }

    if (sized) {
      productInput.options = [{ title: "Size", values: p.variants.map((v) => v.size) }]
      productInput.variants = p.variants.map((v) => ({
        title: v.size,
        sku: v.sku,
        material: p.material,
        weight: v.weight,
        manage_inventory: true,
        options: { Size: v.size },
        prices: [{ amount: v.price, currency_code: "inr" }],
      }))
    } else {
      // single "One size" => mirror existing live products' Default option/variant
      const v = p.variants[0]
      productInput.options = [{ title: "Default option", values: ["Default variant"] }]
      productInput.variants = [
        {
          title: "Default variant",
          sku: v.sku,
          material: p.material,
          weight: v.weight,
          manage_inventory: true,
          options: { "Default option": "Default variant" },
          prices: [{ amount: v.price, currency_code: "inr" }],
        },
      ]
    }

    const { result } = await createProductsWorkflow(container).run({
      input: { products: [productInput] },
    })
    logger.info(`  created product ${result[0].id} with ${imageUrls.length} images, ${videoUrls.length} videos`)

    // inventory
    const skus = p.variants.map((v) => v.sku)
    const { data: invItems } = await query.graph({
      entity: "inventory_item",
      fields: ["id", "sku"],
      filters: { sku: skus },
    })
    const bySku = new Map(invItems.map((i: any) => [i.sku, i.id]))
    const levels: CreateInventoryLevelInput[] = []
    for (const v of p.variants) {
      const invId = bySku.get(v.sku)
      if (invId)
        levels.push({
          inventory_item_id: invId,
          location_id: stockLocationId,
          stocked_quantity: 10,
        })
    }
    if (levels.length) {
      await createInventoryLevelsWorkflow(container).run({
        input: { inventory_levels: levels },
      })
      logger.info(`  set inventory 10 for ${levels.length} variant(s)`)
    } else {
      logger.warn("  no inventory items resolved — stock NOT set")
    }
  }

  logger.info("\nDone.")
}
