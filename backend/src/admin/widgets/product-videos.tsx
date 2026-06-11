import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProduct } from "@medusajs/types"
import { Container, Heading, Button, Text, toast } from "@medusajs/ui"
import { useRef, useState } from "react"

/**
 * Product Videos uploader. Medusa's built-in Media section is images-only, so
 * this widget uploads video files via /admin/uploads (Supabase Storage in prod)
 * and stores the resulting URLs in product.metadata.videos. The storefront
 * product gallery reads metadata.videos and renders them as inline <video>.
 *
 * NOTE: upload on the LIVE admin (api.delfee.in/app) so files land in Supabase
 * with a public URL. A local backend without S3 config saves to disk (localhost
 * URLs) which won't work on the live store.
 */

type DetailWidgetProps = {
  data: AdminProduct
}

const normalizeVideos = (
  meta: Record<string, unknown> | null | undefined
): string[] => {
  const v = meta?.videos
  if (Array.isArray(v)) return v.filter(Boolean) as string[]
  if (typeof v === "string")
    return v.split(",").map((s) => s.trim()).filter(Boolean)
  return []
}

const ProductVideosWidget = ({ data }: DetailWidgetProps) => {
  const [videos, setVideos] = useState<string[]>(normalizeVideos(data.metadata))
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const persist = async (next: string[]) => {
    const res = await fetch(`/admin/products/${data.id}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metadata: { ...(data.metadata || {}), videos: next },
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || "Failed to save videos")
    }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      const form = new FormData()
      Array.from(files).forEach((f) => form.append("files", f))

      const up = await fetch(`/admin/uploads`, {
        method: "POST",
        credentials: "include",
        body: form,
      })
      const json = await up.json()
      if (!up.ok) throw new Error(json.message || "Upload failed")

      const urls: string[] = (json.files || [])
        .map((f: { url?: string }) => f.url)
        .filter(Boolean)
      if (!urls.length) throw new Error("No file URL returned")

      const next = [...videos, ...urls]
      await persist(next)
      setVideos(next)
      toast.success(`Uploaded ${urls.length} video${urls.length > 1 ? "s" : ""}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleRemove = async (url: string) => {
    setBusy(true)
    try {
      const next = videos.filter((v) => v !== url)
      await persist(next)
      setVideos(next)
      toast.success("Video removed")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Product Videos</Heading>
        <Button
          size="small"
          variant="secondary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? "Uploading…" : "Upload video"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div className="px-6 py-4 flex flex-col gap-3">
        {videos.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            No videos yet. Upload .mp4 clips — they show in the product gallery on
            the storefront (after photos).
          </Text>
        ) : (
          videos.map((url) => (
            <div key={url} className="flex items-center gap-3">
              <video
                src={url}
                muted
                playsInline
                preload="metadata"
                style={{
                  width: 96,
                  height: 96,
                  objectFit: "cover",
                  borderRadius: 8,
                  background: "#000",
                  flexShrink: 0,
                }}
              />
              <Text size="small" className="truncate flex-1">
                {url.split("/").pop()}
              </Text>
              <Button
                size="small"
                variant="danger"
                disabled={busy}
                onClick={() => handleRemove(url)}
              >
                Remove
              </Button>
            </div>
          ))
        )}
        <Text size="xsmall" className="text-ui-fg-muted">
          Upload on the live admin so files store to Supabase. Keep clips short
          &amp; web-optimised for fast page loads.
        </Text>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductVideosWidget
