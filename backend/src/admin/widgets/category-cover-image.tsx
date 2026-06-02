import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProductCategory } from "@medusajs/types"
import { Container, Heading, Button, Text } from "@medusajs/ui"
import { useRef, useState, useCallback } from "react"

type DetailWidgetProps = {
  data: AdminProductCategory
}

const CategoryCoverImageWidget = ({ data }: DetailWidgetProps) => {
  const [imageUrl, setImageUrl] = useState<string | null>(
    (data.metadata?.cover_image as string) || null
  )
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        alert("Please upload an image file")
        return
      }

      setUploading(true)
      try {
        const formData = new FormData()
        formData.append("file", file)

        const response = await fetch(
          `/admin/categories/${data.id}/cover-image`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          }
        )

        const result = await response.json()
        if (response.ok) {
          setImageUrl(result.cover_image)
        } else {
          alert(result.message || "Upload failed")
        }
      } catch (error) {
        alert("Upload failed. Please try again.")
      } finally {
        setUploading(false)
      }
    },
    [data.id]
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  const handleRemove = async () => {
    try {
      const response = await fetch(
        `/admin/categories/${data.id}/cover-image`,
        {
          method: "DELETE",
          credentials: "include",
        }
      )

      if (response.ok) {
        setImageUrl(null)
      }
    } catch {
      alert("Failed to remove image")
    }
  }

  return (
    <Container>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Heading level="h2">Cover Image</Heading>

        {imageUrl ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                width: "100%",
                aspectRatio: "3/2",
                borderRadius: "8px",
                overflow: "hidden",
                border: "1px solid #e5e7eb",
              }}
            >
              <img
                src={imageUrl}
                alt="Category cover"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <Button
                variant="secondary"
                size="small"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                Replace
              </Button>
              <Button
                variant="danger"
                size="small"
                onClick={handleRemove}
              >
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            style={{
              width: "100%",
              aspectRatio: "3/2",
              borderRadius: "8px",
              border: `2px dashed ${dragOver ? "#8b5cf6" : "#d1d5db"}`,
              background: dragOver ? "#f5f3ff" : "#f9fafb",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {uploading ? (
              <Text size="small">Uploading...</Text>
            ) : (
              <>
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21zM10.5 8.25a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                  />
                </svg>
                <Text size="small" style={{ marginTop: "8px", color: "#6b7280" }}>
                  Click or drag & drop to upload
                </Text>
                <Text size="xsmall" style={{ color: "#9ca3af" }}>
                  JPG, PNG or WebP (recommended 600x800)
                </Text>
              </>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product_category.details.side.before",
})

export default CategoryCoverImageWidget
