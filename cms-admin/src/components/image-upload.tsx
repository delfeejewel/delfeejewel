import { useState, useCallback } from "react"
import { Upload, message, Button, Spin, Typography } from "antd"
import { UploadOutlined, DeleteOutlined, PictureOutlined } from "@ant-design/icons"
import { supabaseClient } from "../providers/supabase"

const { Text } = Typography
const BUCKET = "assets"

type ImageUploadProps = {
  value?: string
  onChange?: (url: string | undefined) => void
  folder?: string
  aspectHint?: string
  required?: boolean
}

export function ImageUpload({
  value,
  onChange,
  folder = "sections",
  aspectHint = "Recommended: 800×460px, 16:9 ratio",
  required = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)

  const handleUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      message.error("Only image files are allowed")
      return false
    }

    if (file.size > 5 * 1024 * 1024) {
      message.error("Image must be under 5MB")
      return false
    }

    setUploading(true)

    try {
      const ext = file.name.split(".").pop() || "jpg"
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      const { error } = await supabaseClient.storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        })

      if (error) {
        message.error(`Upload failed: ${error.message}`)
        return false
      }

      const { data: urlData } = supabaseClient.storage
        .from(BUCKET)
        .getPublicUrl(path)

      onChange?.(urlData.publicUrl)
      message.success("Image uploaded")
    } catch (err: any) {
      message.error("Upload failed")
    } finally {
      setUploading(false)
    }

    return false // prevent ant default upload
  }, [folder, onChange])

  const handleRemove = useCallback(async () => {
    if (!value) return

    try {
      // Extract path from URL
      const url = new URL(value)
      const pathParts = url.pathname.split(`/storage/v1/object/public/${BUCKET}/`)
      if (pathParts[1]) {
        await supabaseClient.storage.from(BUCKET).remove([pathParts[1]])
      }
    } catch {
      // Ignore delete errors — URL might not be from Supabase
    }

    onChange?.(undefined)
    message.success("Image removed")
  }, [value, onChange])

  if (uploading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 120,
          borderRadius: 8,
          border: "1px dashed rgba(255,255,255,0.15)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <Spin tip="Uploading..." />
      </div>
    )
  }

  if (value) {
    return (
      <div>
        <div
          style={{
            position: "relative",
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)",
            marginBottom: 8,
          }}
        >
          <img
            src={value}
            alt="Uploaded"
            style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }}
          />
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              display: "flex",
              gap: 4,
            }}
          >
            <Upload
              showUploadList={false}
              beforeUpload={handleUpload}
              accept="image/*"
            >
              <Button size="small" icon={<UploadOutlined />}>Replace</Button>
            </Upload>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={handleRemove}>
              Remove
            </Button>
          </div>
        </div>
        <Text type="secondary" style={{ fontSize: 11 }}>{aspectHint}</Text>
      </div>
    )
  }

  return (
    <div>
      <Upload.Dragger
        showUploadList={false}
        beforeUpload={handleUpload}
        accept="image/*"
        style={{
          borderRadius: 8,
          border: "1px dashed rgba(255,255,255,0.15)",
          background: "rgba(255,255,255,0.02)",
          padding: "16px 0",
        }}
      >
        <PictureOutlined style={{ fontSize: 28, color: "#555", marginBottom: 8 }} />
        <p style={{ margin: 0, fontSize: 13, color: "#999" }}>
          Click or drag image to upload
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#666" }}>
          JPG, PNG or WebP · Max 5MB
        </p>
      </Upload.Dragger>
      <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: "block" }}>{aspectHint}</Text>
      {required && !value && (
        <Text type="danger" style={{ fontSize: 11, display: "block", marginTop: 2 }}>Image is required</Text>
      )}
    </div>
  )
}
