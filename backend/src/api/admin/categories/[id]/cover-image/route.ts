import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"

/**
 * Category cover image upload.
 *
 * Stores to Cloudflare R2, NOT Supabase Storage. This route previously talked
 * to Supabase directly (bypassing the configured file provider), so when the
 * Supabase project hit its free-tier quota every category image 402'd AND
 * re-uploading was impossible — the write path pointed at the same dead bucket.
 *
 * Uses the same R2_* credentials as the product-media migration.
 */

function getR2() {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_PUBLIC_URL,
  } = process.env

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_URL) {
    throw new Error(
      "Missing R2 env (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL)"
    )
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })

  return { client, bucket: R2_BUCKET, publicBase: R2_PUBLIC_URL.replace(/\/+$/, "") }
}

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
    const { client, bucket, publicBase } = getR2()

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

    const key = `categories/${id}/${Date.now()}-${filename}`

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileData,
        ContentType: fileContentType,
        // Key includes a timestamp, so each upload is a new immutable object.
        CacheControl: "public, max-age=31536000, immutable",
      })
    )

    const imageUrl = `${publicBase}/${key}`
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
