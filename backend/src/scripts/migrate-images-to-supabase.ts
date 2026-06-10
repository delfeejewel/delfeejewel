/**
 * One-off migration: move product images off the local file provider (which
 * stored them on dev-machine disk and recorded `http://localhost:9000/static/...`
 * URLs in the shared DB) into Supabase Storage, then rewrite every product
 * image + thumbnail URL to the new public Supabase URL.
 *
 * Why this exists: with no file provider configured, Medusa used the built-in
 * local provider. Files live only on the machine that did the upload and the
 * URL is hardcoded to localhost — so product images 404 on the live site.
 *
 * Run it ON THE MACHINE THAT HAS ./static (your dev box), where the physical
 * files still exist:
 *
 *   # preview what would change (no writes):
 *   npx medusa exec ./src/scripts/migrate-images-to-supabase.ts
 *   # actually upload + rewrite the DB:
 *   npx medusa exec ./src/scripts/migrate-images-to-supabase.ts apply
 *
 * Idempotent: already-migrated (supabase URL) images are skipped. Safe to
 * re-run. Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.
 */
import { Modules } from "@medusajs/framework/utils"
import { ExecArgs } from "@medusajs/framework/types"
import { createClient } from "@supabase/supabase-js"
import { promises as fs } from "fs"
import path from "path"

const BUCKET = "product-media"
const STATIC_DIR = path.join(process.cwd(), "static")

// URLs that need migrating: anything served from a /static/ path (covers
// localhost:9000/static and any other host that points at the local provider).
const LOCAL_STATIC_RE = /\/static\/([^/?#]+)/

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
}

export default async function migrateImages({ container }: ExecArgs) {
  const apply = process.argv.includes("apply")
  const logger = container.resolve("logger")

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
  }
  const supabase = createClient(supabaseUrl, supabaseKey)

  logger.info(
    apply
      ? "Running migration in APPLY mode — files will be uploaded and the DB rewritten."
      : "Running migration in DRY-RUN mode — no writes. Pass `apply` to commit."
  )

  // Ensure the public bucket exists.
  if (apply) {
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.some((b) => b.name === BUCKET)) {
      const { error } = await supabase.storage.createBucket(BUCKET, { public: true })
      if (error && !/already exists/i.test(error.message)) {
        throw new Error(`Could not create bucket ${BUCKET}: ${error.message}`)
      }
      logger.info(`Created public bucket "${BUCKET}".`)
    }
  }

  const productModuleService = container.resolve(Modules.PRODUCT)

  const products = await productModuleService.listProducts(
    {},
    { relations: ["images"], take: null }
  )

  // Map of old URL -> new URL so the same file is uploaded only once.
  const urlMap = new Map<string, string>()
  const missing = new Set<string>()

  async function migrateUrl(url?: string | null): Promise<string | null> {
    if (!url) return null
    if (url.includes(`/storage/v1/object/public/${BUCKET}/`)) return null // already done
    const m = url.match(LOCAL_STATIC_RE)
    if (!m) return null // not a local-provider URL — leave it alone

    if (urlMap.has(url)) return urlMap.get(url)!

    const filename = decodeURIComponent(m[1])
    const localPath = path.join(STATIC_DIR, filename)

    let body: Buffer
    try {
      body = await fs.readFile(localPath)
    } catch {
      missing.add(filename)
      return null
    }

    const ext = path.extname(filename).toLowerCase()
    const objectPath = `products/${filename}`

    if (apply) {
      const { error } = await supabase.storage.from(BUCKET).upload(objectPath, body, {
        contentType: CONTENT_TYPES[ext] || "application/octet-stream",
        upsert: true,
      })
      if (error) {
        logger.error(`Upload failed for ${filename}: ${error.message}`)
        return null
      }
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath)
    urlMap.set(url, data.publicUrl)
    return data.publicUrl
  }

  let productsTouched = 0
  let imagesRewritten = 0
  let thumbnailsRewritten = 0

  for (const product of products) {
    const newImages = await Promise.all(
      (product.images || []).map(async (img: any) => {
        const newUrl = await migrateUrl(img.url)
        if (newUrl) imagesRewritten++
        return { id: img.id, url: newUrl || img.url }
      })
    )
    const newThumb = await migrateUrl(product.thumbnail)
    if (newThumb) thumbnailsRewritten++

    const changedImages = newImages.some((n, i) => n.url !== product.images?.[i]?.url)
    const changedThumb = !!newThumb

    if (changedImages || changedThumb) {
      productsTouched++
      if (apply) {
        await productModuleService.updateProducts(product.id, {
          ...(changedImages ? { images: newImages } : {}),
          ...(changedThumb ? { thumbnail: newThumb! } : {}),
        })
      }
    }
  }

  logger.info(
    `${apply ? "Migrated" : "Would migrate"}: ${imagesRewritten} image(s) + ` +
      `${thumbnailsRewritten} thumbnail(s) across ${productsTouched} product(s).`
  )
  if (missing.size) {
    logger.warn(
      `${missing.size} referenced file(s) were NOT found in ./static (uploaded ` +
        `from another machine — re-upload these via the admin):\n  - ` +
        Array.from(missing).join("\n  - ")
    )
  }
  if (!apply) {
    logger.info("Dry run complete. Re-run with `apply` to commit the changes.")
  }
}
