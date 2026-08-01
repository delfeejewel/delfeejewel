import fs from "fs"
import path from "path"
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Set a product category's featured/cover image from a LOCAL file.
 *
 *   npx medusa exec ./src/scripts/set-category-cover-image.ts <category-handle> <file> [apply]
 *
 *   e.g. npx medusa exec ./src/scripts/set-category-cover-image.ts \
 *          anklets ../payal_compressed.webp apply
 *
 * This is the CLI equivalent of the admin Cover Image widget
 * (src/api/admin/categories/[id]/cover-image/route.ts) and deliberately
 * follows the same rules:
 *   - uploads through Medusa's file provider (Modules.FILE -> Cloudflare R2
 *     via S3_* env), so storage stays configured in exactly one place;
 *   - passes `content` as base64 — the provider sniffs the encoding and
 *     silently falls back to utf8, which corrupts binary image data;
 *   - passes a plain filename, since the provider derives the final object
 *     key itself (prefix + name + ULID + ext);
 *   - MERGES into metadata rather than assigning, so sibling keys such as
 *     `hide_from_homepage` survive.
 *
 * DRY RUN by default: pass `apply` to actually upload and write.
 */
export default async function run({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModuleService = container.resolve(Modules.PRODUCT)
  const fileModuleService = container.resolve(Modules.FILE)

  const apply = args.includes("apply")
  const positional = args.filter((a) => a !== "apply")
  const [categoryHandle, filePath] = positional

  if (!categoryHandle || !filePath) {
    logger.error(
      "Usage: set-category-cover-image.ts <category-handle> <file> [apply]"
    )
    return
  }

  const abs = path.resolve(filePath)
  if (!fs.existsSync(abs)) {
    logger.error(`No such file: ${abs}`)
    return
  }

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle", "metadata"],
    filters: { handle: categoryHandle } as any,
  })
  const category: any = categories?.[0]
  if (!category) {
    const { data: all } = await query.graph({
      entity: "product_category",
      fields: ["handle"],
    })
    logger.error(
      `No category with handle "${categoryHandle}". Available: ` +
        (all as any[]).map((c) => c.handle).join(", ")
    )
    return
  }

  const EXT_MIME: Record<string, string> = {
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".avif": "image/avif",
  }
  const ext = path.extname(abs).toLowerCase()
  const mimeType = EXT_MIME[ext]
  if (!mimeType) {
    logger.error(`Unsupported image extension "${ext}".`)
    return
  }

  const data = fs.readFileSync(abs)
  if (!data.length) {
    logger.error("File is empty.")
    return
  }
  const filename = path.basename(abs).replace(/\s+/g, "-")
  const current = (category.metadata as Record<string, unknown> | null)
    ?.cover_image

  logger.info(apply ? "--- APPLYING ---" : "--- DRY RUN (pass `apply`) ---")
  logger.info(`Category : ${category.name} (${category.handle})`)
  logger.info(`File     : ${abs} (${(data.length / 1024).toFixed(0)} KB, ${mimeType})`)
  logger.info(`cover_image current: ${current ? `"${current}"` : "— none —"}`)

  if (!apply) {
    logger.info("Dry run complete — nothing uploaded, nothing written.")
    return
  }

  const [uploaded] = await fileModuleService.createFiles([
    {
      filename: `category-${category.id}-${filename}`,
      mimeType,
      content: data.toString("base64"),
      access: "public",
    },
  ])

  await productModuleService.updateProductCategories(category.id, {
    metadata: {
      ...((category.metadata as Record<string, unknown>) || {}),
      cover_image: uploaded.url,
    },
  })

  logger.info(`cover_image new    : "${uploaded.url}"`)
  logger.info("Done.")
}
