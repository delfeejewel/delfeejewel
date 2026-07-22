import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3"
import fs from "fs"
import path from "path"

/**
 * Migrate product media from Supabase Storage to Cloudflare R2.
 *
 * Uploads from the LOCAL Products/ folder rather than copying bucket-to-bucket,
 * because Supabase Storage is quota-restricted (402) and can't be read. The
 * local folder is the original source of truth, and products-data.md maps each
 * product handle to its folder and its ordered image/video filenames.
 *
 * Usage (DRY RUN by default):
 *   npx medusa exec ./src/scripts/migrate-media-to-r2.ts
 *   npx medusa exec ./src/scripts/migrate-media-to-r2.ts apply
 *   npx medusa exec ./src/scripts/migrate-media-to-r2.ts apply upload-only
 *   npx medusa exec ./src/scripts/migrate-media-to-r2.ts apply db-only
 *
 * Env required:
 *   R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET R2_PUBLIC_URL
 *
 * Idempotent: objects already present in R2 (same key + size) are skipped, so a
 * failed run can simply be re-run.
 */

const REPO = "/Users/wft-dev16/Personal/e-commerce"
const MD = path.join(REPO, "Products/products-data.md")

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
}

type Entry = { folder: string; thumbnail?: string; images: string[]; videos: string[] }

/** handle -> { folder, thumbnail, ordered images, ordered videos } from the md. */
function parseMd(): Map<string, Entry> {
  const out = new Map<string, Entry>()
  let folder = ""
  let handle = ""
  let cur: Entry | null = null

  const backticked = (line: string): string[] => {
    const groups = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1])
    // a group may itself be a comma-separated list
    return groups.flatMap((g) => g.split(",").map((s) => s.trim())).filter(Boolean)
  }

  for (const raw of fs.readFileSync(MD, "utf8").split("\n")) {
    const line = raw.trim()
    const f = line.match(/^### Prod-\d+\s*→\s*`([^`]+)`/)
    if (f) {
      folder = f[1]
      handle = ""
      cur = null
      continue
    }
    const h = line.match(/^- \*\*Handle:\*\*\s*`([^`]+)`/)
    if (h && folder) {
      handle = h[1]
      cur = { folder, images: [], videos: [] }
      out.set(handle, cur)
      continue
    }
    if (!cur) continue
    if (/^- \*\*Thumbnail:\*\*/.test(line)) cur.thumbnail = backticked(line)[0]
    else if (/^- \*\*Gallery images:\*\*/.test(line)) cur.images = backticked(line)
    else if (/^- \*\*Video media:\*\*/.test(line)) cur.videos = backticked(line)
  }
  return out
}

export default async function run({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const apply = args.includes("apply")
  const uploadOnly = args.includes("upload-only")
  const dbOnly = args.includes("db-only")

  const {
    R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
    R2_BUCKET, R2_PUBLIC_URL,
  } = process.env

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_URL) {
    logger.error("Missing R2_* env vars (ACCOUNT_ID, ACCESS_KEY_ID, SECRET_ACCESS_KEY, BUCKET, PUBLIC_URL)")
    return
  }
  const publicBase = R2_PUBLIC_URL.replace(/\/+$/, "")

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })

  const md = parseMd()
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "thumbnail", "images.url", "metadata"],
    pagination: { take: 1000, skip: 0 },
  })

  let uploaded = 0, skipped = 0, failed = 0, rewritten = 0, missingFiles = 0, notReady = 0
  const unmatched: string[] = []
  let plannedBytes = 0

  // Snapshot the bucket once instead of a HEAD per file. With ~2000 files that
  // is 2000 round-trips saved, and it gives us a cheap way to tell whether a
  // given product is FULLY uploaded before we repoint its URLs.
  const inR2 = new Map<string, number>()
  {
    let token: string | undefined
    do {
      const r: any = await s3.send(
        new ListObjectsV2Command({ Bucket: R2_BUCKET, ContinuationToken: token })
      )
      for (const o of r.Contents || []) inR2.set(o.Key, Number(o.Size) || 0)
      token = r.IsTruncated ? r.NextContinuationToken : undefined
    } while (token)
  }
  logger.info(`R2 already holds ${inR2.size} object(s)`)

  const alreadyThere = (key: string, size: number) => inR2.get(key) === size

  for (const p of products as any[]) {
    const entry = md.get(p.handle)
    if (!entry) {
      unmatched.push(p.handle)
      continue
    }

    const dir = path.join(REPO, entry.folder)
    if (!fs.existsSync(dir)) {
      unmatched.push(`${p.handle} (folder missing)`)
      continue
    }

    // Resolve against what's ACTUALLY on disk, using the md only for ORDER.
    // Trusting md filenames loses files: gallery lines are comma-separated, so a
    // name containing commas ("ChatGPT Image Jun 27, 2026, 04_11_15 PM.png")
    // shreds into fragments, and some md entries list the wrong extension
    // (5.png vs 5.jpg on disk). Both cases silently dropped a real image.
    const onDisk = fs.readdirSync(dir).filter((f) => !f.startsWith("."))
    const isImage = (f: string) => /\.(jpe?g|png|webp)$/i.test(f)
    const isVideo = (f: string) => /\.mp4$/i.test(f)

    // Natural sort so 2.jpeg precedes 10.jpeg, and numbered files precede named ones.
    const natural = (a: string, b: string) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })

    // md order first (matched loosely by basename, ignoring extension), then any
    // remaining files on disk — so nothing is ever lost.
    const rank = (list: string[]) => (f: string) => {
      const base = path.parse(f).name.toLowerCase()
      const i = list.findIndex((m) => path.parse(m).name.toLowerCase() === base)
      return i === -1 ? Number.MAX_SAFE_INTEGER : i
    }
    const orderBy = (list: string[], files: string[]) => {
      const r = rank(list)
      return files.sort((a, b) => r(a) - r(b) || natural(a, b))
    }

    const images = orderBy(entry.images, onDisk.filter(isImage))
    const videos = orderBy(entry.videos, onDisk.filter(isVideo))

    // Thumbnail: honour the md choice if it resolves on disk, else first image.
    const thumbBase = entry.thumbnail ? path.parse(entry.thumbnail).name.toLowerCase() : null
    const thumbnail =
      (thumbBase && images.find((f) => path.parse(f).name.toLowerCase() === thumbBase)) ||
      images[0]

    const files = [...new Set([...images, ...videos])]

    const urlFor = (f: string) => `${publicBase}/products/${p.handle}/${encodeURIComponent(f)}`

    for (const f of files) {
      const abs = path.join(dir, f)
      if (!fs.existsSync(abs)) {
        logger.warn(`  missing on disk: ${entry.folder}/${f}`)
        missingFiles++
        continue
      }
      const size = fs.statSync(abs).size
      plannedBytes += size
      const key = `products/${p.handle}/${f}`

      if (!apply || dbOnly) continue

      if (alreadyThere(key, size)) { skipped++; continue }
      try {
        await s3.send(new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: fs.createReadStream(abs),
          ContentLength: size,
          ContentType: CONTENT_TYPES[path.extname(f).toLowerCase()] || "application/octet-stream",
          // Immutable content addressed by product + filename; cache hard at the edge.
          CacheControl: "public, max-age=31536000, immutable",
        }))
        inR2.set(key, size) // so the rewrite step below sees it immediately
        uploaded++
      } catch (e: any) {
        logger.error(`  upload failed ${key}: ${e.message}`)
        failed++
      }
    }

    // Only repoint a product once every one of its files is actually in R2.
    // Rewriting early would turn a 402 into a 404 — visibly worse, and harder
    // to spot because a 404 looks like a genuine missing image.
    const fullyUploaded = files.every((f) => {
      const abs = path.join(dir, f)
      if (!fs.existsSync(abs)) return true // nothing we can upload; don't block
      return inR2.get(`products/${p.handle}/${f}`) === fs.statSync(abs).size
    })

    if (apply && !uploadOnly && !fullyUploaded) {
      notReady++
      continue
    }

    if (apply && !uploadOnly) {
      const newThumb = thumbnail ? urlFor(thumbnail) : p.thumbnail
      const newImages = images.map((f) => ({ url: urlFor(f) }))
      const newVideos = videos.map((f) => urlFor(f))
      await updateProductsWorkflow(container).run({
        input: {
          products: [{
            id: p.id,
            thumbnail: newThumb,
            images: newImages,
            metadata: { ...((p.metadata as any) || {}), videos: newVideos },
          }],
        },
      })
      rewritten++
    }
  }

  const GB = 1073741824
  console.log("")
  logger.info(apply ? "APPLIED" : "DRY RUN (pass `apply` to write)")
  logger.info(`  products matched : ${(products as any[]).length - unmatched.length}/${(products as any[]).length}`)
  logger.info(`  media to migrate : ${(plannedBytes / GB).toFixed(2)} GB`)
  if (apply) {
    logger.info(`  uploaded         : ${uploaded}`)
    logger.info(`  already in R2    : ${skipped}`)
    logger.info(`  upload failures  : ${failed}`)
    logger.info(`  products rewritten: ${rewritten}`)
    if (notReady) logger.info(`  not yet in R2 (left on old URLs): ${notReady}`)
  }
  if (missingFiles) logger.warn(`  files missing on disk: ${missingFiles}`)
  if (unmatched.length) {
    logger.warn(`  no md entry (left untouched): ${unmatched.join(", ")}`)
  }
}
