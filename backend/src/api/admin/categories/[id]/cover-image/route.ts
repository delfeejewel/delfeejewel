import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * Category cover image upload.
 *
 * Uploads through Medusa's configured file provider (Modules.FILE), which is
 * pointed at Cloudflare R2 via the S3_* env in medusa-config.ts.
 *
 * This route used to talk to Supabase Storage directly, bypassing the file
 * provider — so when the Supabase project hit its free-tier quota every
 * category image 402'd AND re-uploading was impossible, because the write path
 * pointed at the same dead bucket. It briefly used its own S3 client against
 * R2_* env, which then failed in production because the droplet configures R2
 * under S3_*. Going through the file provider means there is exactly one place
 * storage is configured, and this route follows it automatically.
 */

/** Merge into existing metadata — assigning a bare object wipes sibling keys. */
async function patchCategoryMetadata(
  req: MedusaRequest,
  id: string,
  patch: Record<string, unknown>
) {
  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const existing: any = await productModuleService
    .retrieveProductCategory(id)
    .catch(() => null)
  await productModuleService.updateProductCategories(id, {
    metadata: { ...((existing?.metadata as Record<string, unknown>) || {}), ...patch },
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { id } = req.params
    const fileModuleService = req.scope.resolve(Modules.FILE)

    const contentType = req.headers["content-type"] || ""
    if (!contentType.includes("multipart/form-data")) {
      return res.status(400).json({ message: "Content-Type must be multipart/form-data" })
    }

    const chunks: Buffer[] = []
    for await (const chunk of req as any) {
      chunks.push(Buffer.from(chunk))
    }
    const body = Buffer.concat(chunks)

    const boundary = contentType.split("boundary=")[1]
    if (!boundary) {
      return res.status(400).json({ message: "Missing boundary in Content-Type" })
    }

    const boundaryBuffer = Buffer.from(`--${boundary}`)
    const parts: Buffer[] = []
    let start = body.indexOf(boundaryBuffer) + boundaryBuffer.length + 2 // skip \r\n

    while (true) {
      const nextBoundary = body.indexOf(boundaryBuffer, start)
      if (nextBoundary === -1) break
      const part = body.subarray(start, nextBoundary - 2) // strip trailing \r\n
      parts.push(part)
      start = nextBoundary + boundaryBuffer.length + 2
    }

    if (parts.length === 0) {
      return res.status(400).json({ message: "No file uploaded" })
    }

    const headerEnd = parts[0].indexOf("\r\n\r\n")
    const headers = parts[0].subarray(0, headerEnd).toString()
    const fileData = parts[0].subarray(headerEnd + 4)

    const filenameMatch = headers.match(/filename="([^"]+)"/)
    const contentTypeMatch = headers.match(/Content-Type: (.+)/)
    // Strip path separators and spaces so the object key stays clean and the
    // resulting URL needs no escaping.
    const rawName = filenameMatch?.[1] || "image.jpg"
    const filename = rawName.split(/[\\/]/).pop()!.replace(/\s+/g, "-")
    const fileContentType = contentTypeMatch?.[1]?.trim() || "image/jpeg"

    if (!fileData.length) {
      return res.status(400).json({ message: "Uploaded file was empty" })
    }

    // Pass a plain filename: the provider derives the final object key itself
    // (prefix + name + ULID + ext), so any directory prefix here would be
    // silently dropped. The ULID already makes every upload a fresh immutable
    // object, so no timestamp of our own is needed.
    //
    // content MUST be base64. The provider sniffs the encoding and falls back
    // to utf8, which corrupts binary image data without raising an error.
    const [uploaded] = await fileModuleService.createFiles([
      {
        filename: `category-${id}-${filename}`,
        mimeType: fileContentType,
        content: fileData.toString("base64"),
        access: "public",
      },
    ])

    const imageUrl = uploaded.url
    await patchCategoryMetadata(req, id, { cover_image: imageUrl })

    return res.json({
      cover_image: imageUrl,
      message: "Cover image uploaded successfully",
    })
  } catch (error: any) {
    console.error("Cover image upload error:", error)
    return res.status(500).json({ message: error.message })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { id } = req.params
    // Only clear the pointer; the object is left in R2 (cheap, and keeps the
    // image recoverable if this was a mistake).
    await patchCategoryMetadata(req, id, { cover_image: null })
    return res.json({ message: "Cover image removed successfully" })
  } catch (error: any) {
    return res.status(500).json({ message: error.message })
  }
}
