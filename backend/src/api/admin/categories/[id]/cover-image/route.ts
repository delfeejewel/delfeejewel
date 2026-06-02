import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { createClient } from "@supabase/supabase-js"

const BUCKET_NAME = "category-images"

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env variables")
  }

  return createClient(supabaseUrl, supabaseKey)
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { id } = req.params
    const supabase = getSupabaseClient()

    // Parse multipart form data
    const contentType = req.headers["content-type"] || ""
    if (!contentType.includes("multipart/form-data")) {
      return res.status(400).json({ message: "Content-Type must be multipart/form-data" })
    }

    // Read the raw body as buffer
    const chunks: Buffer[] = []
    for await (const chunk of req as any) {
      chunks.push(Buffer.from(chunk))
    }
    const body = Buffer.concat(chunks)

    // Extract boundary from content-type
    const boundary = contentType.split("boundary=")[1]
    if (!boundary) {
      return res.status(400).json({ message: "Missing boundary in Content-Type" })
    }

    // Parse multipart data manually
    const boundaryBuffer = Buffer.from(`--${boundary}`)
    const parts = []
    let start = body.indexOf(boundaryBuffer) + boundaryBuffer.length + 2 // skip \r\n

    while (true) {
      const nextBoundary = body.indexOf(boundaryBuffer, start)
      if (nextBoundary === -1) break

      const part = body.subarray(start, nextBoundary - 2) // remove trailing \r\n
      parts.push(part)
      start = nextBoundary + boundaryBuffer.length + 2
    }

    if (parts.length === 0) {
      return res.status(400).json({ message: "No file uploaded" })
    }

    // Parse the first part (the file)
    const headerEnd = parts[0].indexOf("\r\n\r\n")
    const headers = parts[0].subarray(0, headerEnd).toString()
    const fileData = parts[0].subarray(headerEnd + 4)

    // Extract filename and content type
    const filenameMatch = headers.match(/filename="([^"]+)"/)
    const contentTypeMatch = headers.match(/Content-Type: (.+)/)
    const filename = filenameMatch?.[1] || "image.jpg"
    const fileContentType = contentTypeMatch?.[1]?.trim() || "image/jpeg"

    // Upload to Supabase Storage
    const filePath = `categories/${id}/${Date.now()}-${filename}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileData, {
        contentType: fileContentType,
        upsert: true,
      })

    if (uploadError) {
      return res.status(500).json({ message: "Upload failed", error: uploadError.message })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath)

    const imageUrl = urlData.publicUrl

    // Update category metadata with cover image URL
    const productModuleService = req.scope.resolve(Modules.PRODUCT)
    await productModuleService.updateProductCategories(id, {
      metadata: { cover_image: imageUrl },
    })

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

    // Remove cover image from category metadata
    const productModuleService = req.scope.resolve(Modules.PRODUCT)
    await productModuleService.updateProductCategories(id, {
      metadata: { cover_image: null },
    })

    return res.json({ message: "Cover image removed successfully" })
  } catch (error: any) {
    return res.status(500).json({ message: error.message })
  }
}
