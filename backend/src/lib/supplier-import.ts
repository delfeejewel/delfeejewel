/**
 * Supplier & Product sync — CSV importer core (item 9.4).
 *
 * Upsert-by-SKU: a supplier sheet can be re-uploaded to re-sync stock/price
 * without creating duplicates. New SKUs create a simple single-variant product;
 * known SKUs update price / stock / status / supplier in place.
 *
 * No third-party service and no new npm dependency — the CSV parser is a small
 * RFC-4180 reader below. Images are re-hosted to our own Supabase bucket (we own
 * the asset rather than hot-linking the supplier).
 *
 * Two phases share one code path:
 *   - planImport()  reads only — resolves each row to create / update / error
 *                   and is used for the dry-run preview.
 *   - applyImport() takes those plans and performs the writes.
 * The apply API route re-plans server-side before applying, so the client never
 * supplies trusted state (avoids TOCTOU / tampering).
 */
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  updateProductsWorkflow,
  updateProductVariantsWorkflow,
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
} from "@medusajs/medusa/core-flows"
import { createClient } from "@supabase/supabase-js"

const CURRENCY = "inr"
const STOCK_LOCATION_NAME = "Chandigarh Store"
const IMAGE_BUCKET = "product-media"
const MAX_ROWS = 1000
const TAG_DELIM = "|" // tags within a cell are pipe-separated (commas split fields)

// Recognised CSV headers (case-insensitive). sku is the only hard requirement.
export const TEMPLATE_HEADERS = [
  "sku",
  "title",
  "description",
  "category",
  "tags",
  "price_inr",
  "stock",
  "status",
  "supplier",
  "weight_g",
  "image_url",
] as const

export type ImportAction = "create" | "update" | "error"

export type PlannedData = {
  sku: string
  title?: string
  description?: string
  status?: "draft" | "published"
  priceInr?: number
  stock?: number | null // null = column blank → leave inventory untouched
  categoryId?: string | null
  categoryName?: string // for messaging
  tagValues: string[]
  supplier?: string
  weightG?: number
  imageUrl?: string
  existingProductId?: string
  existingVariantId?: string
}

export type RowPlan = {
  line: number // 1-based data-row number (excludes the header row)
  sku: string
  title: string
  action: ImportAction
  messages: string[] // warnings (create/update) or the error reason
  data?: PlannedData
}

export type RowResult = RowPlan & {
  ok: boolean
  result?: string // e.g. "created", "updated price + stock"
}

// ──────────────────────────────────────────────────────────────────────────
// CSV parsing (RFC-4180-ish: quoted fields, escaped "" quotes, \n or \r\n)
// ──────────────────────────────────────────────────────────────────────────
export function parseCsv(text: string): Record<string, string>[] {
  const s = text.replace(/^﻿/, "") // strip BOM
  const rows: string[][] = []
  let field = ""
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else if (c === "\r") {
      // ignore — \r\n handled by the \n branch
    } else {
      field += c
    }
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }

  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim().toLowerCase())
  const out: Record<string, string>[] = []
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]
    // skip fully-empty lines
    if (cells.every((c) => c.trim() === "")) continue
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? "").trim()
    })
    out.push(obj)
  }
  return out
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function parseStatus(raw: string): "draft" | "published" | undefined {
  const v = raw.trim().toLowerCase()
  if (!v) return undefined
  if (v === "published" || v === "active" || v === "live") return "published"
  if (v === "draft" || v === "proposed" || v === "inactive") return "draft"
  return undefined
}

// ──────────────────────────────────────────────────────────────────────────
// Planning (read-only)
// ──────────────────────────────────────────────────────────────────────────
export async function planImport(
  container: any,
  rows: Record<string, string>[]
): Promise<RowPlan[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const plans: RowPlan[] = []

  // Resolve all categories once (small set) for name/handle matching.
  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle"],
  })
  const catByKey = new Map<string, any>()
  for (const c of categories) {
    catByKey.set(String(c.name).toLowerCase(), c)
    catByKey.set(String(c.handle).toLowerCase(), c)
  }

  const seenSku = new Set<string>()
  const limit = Math.min(rows.length, MAX_ROWS)

  for (let i = 0; i < limit; i++) {
    const raw = rows[i]
    const line = i + 1
    const sku = (raw.sku || "").trim()
    const title = (raw.title || "").trim()
    const messages: string[] = []

    const err = (msg: string): RowPlan => ({
      line,
      sku,
      title,
      action: "error",
      messages: [msg],
    })

    if (!sku) {
      plans.push(err("Missing SKU (the sku column is required)."))
      continue
    }
    if (seenSku.has(sku.toLowerCase())) {
      plans.push(err(`Duplicate SKU "${sku}" earlier in this file.`))
      continue
    }
    seenSku.add(sku.toLowerCase())

    // Find an existing variant by SKU → decides create vs update.
    const { data: variants } = await query.graph({
      entity: "product_variant",
      fields: ["id", "sku", "product_id", "product.title"],
      filters: { sku },
    })
    const existing = variants?.[0]

    // Parse the optional fields.
    const priceRaw = (raw.price_inr || "").trim()
    let priceInr: number | undefined
    if (priceRaw) {
      const n = Number(priceRaw.replace(/[, ]/g, ""))
      if (!Number.isFinite(n) || n < 0) {
        plans.push(err(`Invalid price_inr "${priceRaw}".`))
        continue
      }
      priceInr = n
    }

    const stockRaw = (raw.stock || "").trim()
    let stock: number | null = null
    if (stockRaw) {
      const n = Number(stockRaw.replace(/[, ]/g, ""))
      if (!Number.isInteger(n) || n < 0) {
        plans.push(err(`Invalid stock "${stockRaw}" (whole number ≥ 0).`))
        continue
      }
      stock = n
    }

    const statusRaw = (raw.status || "").trim()
    let status = parseStatus(statusRaw)
    if (statusRaw && !status) {
      messages.push(`Unknown status "${statusRaw}" — ignored.`)
    }

    const weightRaw = (raw.weight_g || "").trim()
    let weightG: number | undefined
    if (weightRaw) {
      const n = Number(weightRaw.replace(/[, ]/g, ""))
      if (Number.isFinite(n) && n >= 0) weightG = n
      else messages.push(`Invalid weight_g "${weightRaw}" — ignored.`)
    }

    // Category by name or handle.
    let categoryId: string | null = null
    let categoryName: string | undefined
    const catRaw = (raw.category || "").trim()
    if (catRaw) {
      const hit = catByKey.get(catRaw.toLowerCase())
      if (hit) {
        categoryId = hit.id
        categoryName = hit.name
      } else {
        messages.push(
          `Category "${catRaw}" not found — product imported without a category.`
        )
      }
    }

    // Tags (pipe-separated).
    const tagValues = (raw.tags || "")
      .split(TAG_DELIM)
      .map((t) => t.trim())
      .filter(Boolean)

    const imageUrl = (raw.image_url || "").trim() || undefined
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      messages.push(`image_url "${imageUrl}" is not an http(s) URL — skipped.`)
    }

    const data: PlannedData = {
      sku,
      title: title || undefined,
      description: (raw.description || "").trim() || undefined,
      status,
      priceInr,
      stock,
      categoryId,
      categoryName,
      tagValues,
      supplier: (raw.supplier || "").trim() || undefined,
      weightG,
      imageUrl: imageUrl && /^https?:\/\//i.test(imageUrl) ? imageUrl : undefined,
    }

    if (existing) {
      data.existingProductId = existing.product_id
      data.existingVariantId = existing.id
      const willUpdate: string[] = []
      if (priceInr !== undefined) willUpdate.push("price")
      if (stock !== null) willUpdate.push("stock")
      if (status) willUpdate.push("status")
      if (data.supplier) willUpdate.push("supplier")
      if (title) willUpdate.push("title")
      if (data.description) willUpdate.push("description")
      if (categoryId) willUpdate.push("category")
      if (tagValues.length) willUpdate.push("tags")
      if (weightG !== undefined) willUpdate.push("weight")
      if (data.imageUrl) willUpdate.push("image")
      if (willUpdate.length === 0) {
        messages.unshift("Nothing to update for this SKU.")
      } else {
        messages.unshift(`Will update: ${willUpdate.join(", ")}.`)
      }
      plans.push({
        line,
        sku,
        title: title || existing.product?.title || sku,
        action: "update",
        messages,
        data,
      })
    } else {
      // Creating — title + price are required for a sellable product.
      if (!title) {
        plans.push(err("New SKU needs a title."))
        continue
      }
      if (priceInr === undefined) {
        plans.push(err("New SKU needs a price_inr."))
        continue
      }
      if (stock === null) {
        messages.push("No stock given — new product starts at 0 on hand.")
      }
      plans.push({
        line,
        sku,
        title,
        action: "create",
        messages,
        data,
      })
    }
  }

  if (rows.length > MAX_ROWS) {
    plans.push({
      line: MAX_ROWS + 1,
      sku: "",
      title: "",
      action: "error",
      messages: [
        `File has ${rows.length} rows — only the first ${MAX_ROWS} were processed. Split the file and re-import the rest.`,
      ],
    })
  }

  return plans
}

// ──────────────────────────────────────────────────────────────────────────
// Apply (writes)
// ──────────────────────────────────────────────────────────────────────────
function getSupabase(): ReturnType<typeof createClient> | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function rehostImage(
  supabase: ReturnType<typeof createClient>,
  url: string,
  sku: string
): Promise<string | null> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`fetch ${resp.status}`)
  const contentType = resp.headers.get("content-type") || "image/jpeg"
  const buf = Buffer.from(await resp.arrayBuffer())
  const extFromType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
  }
  const ext = extFromType[contentType.split(";")[0].trim()] || "jpg"
  const objectPath = `imports/${slugify(sku) || "item"}-${buf.length}.${ext}`
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(objectPath, buf, { contentType, upsert: true })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(objectPath)
  return data.publicUrl
}

/** Find-or-create product tags by value; returns the tag ids. */
async function resolveTagIds(
  container: any,
  values: string[]
): Promise<string[]> {
  if (!values.length) return []
  const productService = container.resolve(Modules.PRODUCT)
  const ids: string[] = []
  for (const value of values) {
    const existing = await productService.listProductTags({ value })
    if (existing?.[0]) {
      ids.push(existing[0].id)
    } else {
      const created = await productService.createProductTags([{ value }])
      ids.push(created[0].id)
    }
  }
  return ids
}

/** Overwrite on-hand stock for a SKU at the primary location. */
async function setStockBySku(
  container: any,
  sku: string,
  qty: number,
  locationId: string
): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: items } = await query.graph({
    entity: "inventory_item",
    fields: [
      "id",
      "sku",
      "location_levels.location_id",
      "location_levels.stocked_quantity",
    ],
    filters: { sku },
  })
  const item = items?.[0]
  if (!item) throw new Error(`no inventory item for sku ${sku}`)
  const hasLevel = (item.location_levels || []).some(
    (l: any) => l.location_id === locationId
  )
  if (hasLevel) {
    await updateInventoryLevelsWorkflow(container).run({
      input: {
        updates: [
          {
            inventory_item_id: item.id,
            location_id: locationId,
            stocked_quantity: qty,
          },
        ],
      },
    })
  } else {
    await createInventoryLevelsWorkflow(container).run({
      input: {
        inventory_levels: [
          {
            inventory_item_id: item.id,
            location_id: locationId,
            stocked_quantity: qty,
          },
        ],
      },
    })
  }
}

export async function applyImport(
  container: any,
  plans: RowPlan[]
): Promise<RowResult[]> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productService = container.resolve(Modules.PRODUCT)

  // Resolve shared dependencies once.
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const [defaultSalesChannel] =
    await salesChannelService.listSalesChannels({})
  const [shippingProfile] = await fulfillmentService.listShippingProfiles({})

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const location =
    locations.find((l: any) => l.name === STOCK_LOCATION_NAME) || locations[0]
  const locationId = location?.id

  const supabase = getSupabase()

  const results: RowResult[] = []

  for (const plan of plans) {
    if (plan.action === "error" || !plan.data) {
      results.push({ ...plan, ok: false })
      continue
    }
    const d = plan.data
    const messages = [...plan.messages]
    try {
      // Tags (find-or-create) and image (re-host) — best effort.
      const tagIds = await resolveTagIds(container, d.tagValues)

      let imageUrl: string | undefined
      if (d.imageUrl) {
        if (!supabase) {
          messages.push("Image skipped — storage not configured.")
        } else {
          try {
            imageUrl = (await rehostImage(supabase, d.imageUrl, d.sku)) || undefined
          } catch (e: any) {
            messages.push(`Image skipped — ${e?.message || e}.`)
          }
        }
      }

      if (plan.action === "create") {
        // Unique handle: base on title, suffix with sku if taken.
        let handle = slugify(d.title || d.sku) || slugify(d.sku)
        const { data: clash } = await query.graph({
          entity: "product",
          fields: ["id"],
          filters: { handle },
        })
        if (clash?.length) handle = `${handle}-${slugify(d.sku)}`

        await createProductsWorkflow(container).run({
          input: {
            products: [
              {
                title: d.title!,
                handle,
                status:
                  d.status === "draft"
                    ? ProductStatus.DRAFT
                    : ProductStatus.PUBLISHED,
                description: d.description,
                ...(d.weightG !== undefined ? { weight: d.weightG } : {}),
                ...(imageUrl
                  ? { thumbnail: imageUrl, images: [{ url: imageUrl }] }
                  : {}),
                metadata: d.supplier ? { supplier: d.supplier } : {},
                ...(d.categoryId ? { category_ids: [d.categoryId] } : {}),
                ...(tagIds.length ? { tags: tagIds.map((id) => ({ id })) } : {}),
                ...(shippingProfile
                  ? { shipping_profile_id: shippingProfile.id }
                  : {}),
                ...(defaultSalesChannel
                  ? { sales_channels: [{ id: defaultSalesChannel.id }] }
                  : {}),
                options: [{ title: "Default", values: ["Default"] }],
                variants: [
                  {
                    title: d.title!,
                    sku: d.sku,
                    manage_inventory: true,
                    options: { Default: "Default" },
                    prices: [{ amount: d.priceInr!, currency_code: CURRENCY }],
                  },
                ],
              },
            ],
          },
        })

        // Inventory item is auto-created (qty 0) — set on-hand if given.
        if (d.stock !== null && d.stock !== undefined && locationId) {
          await setStockBySku(container, d.sku, d.stock, locationId)
        }

        results.push({
          ...plan,
          messages,
          ok: true,
          result: `created${d.stock !== null ? ` (stock ${d.stock})` : ""}`,
        })
        continue
      }

      // ─── update ───────────────────────────────────────────────────────
      const did: string[] = []

      // Product-level fields (merge supplier into existing metadata).
      const productUpdate: any = { id: d.existingProductId }
      let touchProduct = false
      if (d.status) {
        productUpdate.status =
          d.status === "draft" ? ProductStatus.DRAFT : ProductStatus.PUBLISHED
        touchProduct = true
        did.push("status")
      }
      if (d.title) {
        productUpdate.title = d.title
        touchProduct = true
        did.push("title")
      }
      if (d.description) {
        productUpdate.description = d.description
        touchProduct = true
        did.push("description")
      }
      if (d.weightG !== undefined) {
        productUpdate.weight = d.weightG
        touchProduct = true
        did.push("weight")
      }
      if (d.categoryId) {
        productUpdate.category_ids = [d.categoryId]
        touchProduct = true
        did.push("category")
      }
      if (tagIds.length) {
        productUpdate.tags = tagIds.map((id) => ({ id }))
        touchProduct = true
        did.push("tags")
      }
      if (imageUrl) {
        productUpdate.thumbnail = imageUrl
        productUpdate.images = [{ url: imageUrl }]
        touchProduct = true
        did.push("image")
      }
      if (d.supplier) {
        const [prod] = await productService.listProducts(
          { id: d.existingProductId },
          { select: ["id", "metadata"] }
        )
        productUpdate.metadata = { ...(prod?.metadata || {}), supplier: d.supplier }
        touchProduct = true
        did.push("supplier")
      }
      if (touchProduct) {
        await updateProductsWorkflow(container).run({
          input: { products: [productUpdate] },
        })
      }

      // Price (variant-level, doesn't disturb sibling variants).
      if (d.priceInr !== undefined) {
        await updateProductVariantsWorkflow(container).run({
          input: {
            product_variants: [
              {
                id: d.existingVariantId,
                prices: [{ amount: d.priceInr, currency_code: CURRENCY }],
              },
            ],
          },
        })
        did.push("price")
      }

      // Stock (overwrite, skip-blank already handled — stock is null when blank).
      if (d.stock !== null && d.stock !== undefined && locationId) {
        await setStockBySku(container, d.sku, d.stock, locationId)
        did.push(`stock=${d.stock}`)
      }

      results.push({
        ...plan,
        messages,
        ok: true,
        result: did.length ? `updated ${did.join(", ")}` : "no changes",
      })
    } catch (e: any) {
      logger.error(`Import row ${plan.line} (${plan.sku}): ${e?.message || e}`)
      results.push({
        ...plan,
        messages: [...messages, e?.message || String(e)],
        ok: false,
      })
    }
  }

  return results
}

/** The downloadable CSV template (headers + one example row). */
export function csvTemplate(): string {
  const example = [
    "DF-RING-001",
    "Silver Twist Ring",
    "Handcrafted 925 sterling silver twist band.",
    "Rings",
    "silver|everyday|gift",
    "2499",
    "25",
    "published",
    "Jaipur Silver Co",
    "6",
    "",
  ]
  return `${TEMPLATE_HEADERS.join(",")}\n${example
    .map((c) => (c.includes(",") ? `"${c}"` : c))
    .join(",")}\n`
}
