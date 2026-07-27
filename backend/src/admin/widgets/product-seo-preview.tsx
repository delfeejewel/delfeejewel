import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProduct } from "@medusajs/types"
import {
  Container,
  Heading,
  Text,
  Badge,
  Input,
  Textarea,
  Button,
  Label,
  toast,
} from "@medusajs/ui"
import { useRef, useState } from "react"

/**
 * SEO editor + preview + score for a product. Medusa has no native SEO
 * fields, so this widget lets an admin override the meta title, meta
 * description, and social-share (OG/Twitter) image — stored on
 * product.metadata.seo_title / seo_description / seo_image. The storefront's
 * generateMetadata() (products/[handle]/page.tsx) uses these verbatim when
 * present, falling back to its own auto-generated title/description/images
 * otherwise.
 *
 * NOTE: upload the image on the LIVE admin (api.delfee.in/app) so it lands in
 * Supabase with a public URL — a local backend without S3/Supabase config
 * saves to disk (localhost URL) which won't resolve on the live store.
 */
const BRAND = {
  name: "Delfee",
  tagline: "Handcrafted Fine Jewellery",
  productSuffix: "Delfee",
}

type DetailWidgetProps = { data: AdminProduct }
type Status = "good" | "warn" | "bad"
type Check = { label: string; status: Status; hint: string }

const capitalize = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())
const noHyphens = (s: string) =>
  s.replace(/[-‐-―−]+/g, " ").replace(/\s{2,}/g, " ").trim()
const trimMeta = (s: string, n = 160) =>
  s.length <= n ? s : `${s.slice(0, s.lastIndexOf(" ", n)).trim()}…`

// Circle fill (white text sits on it) vs. accent (dots + label text, brighter for dark bg)
const FILL: Record<Status, string> = { good: "#15803d", warn: "#b45309", bad: "#b91c1c" }
const ACCENT: Record<Status, string> = { good: "#22c55e", warn: "#f59e0b", bad: "#f87171" }

const ProductSeoPreviewWidget = ({ data }: DetailWidgetProps) => {
  const meta = (data.metadata || {}) as Record<string, unknown>

  const [seoTitleOverride, setSeoTitleOverride] = useState(
    typeof meta.seo_title === "string" ? meta.seo_title : ""
  )
  const [seoDescOverride, setSeoDescOverride] = useState(
    typeof meta.seo_description === "string" ? meta.seo_description : ""
  )
  const [seoImage, setSeoImage] = useState(
    typeof meta.seo_image === "string" ? meta.seo_image : ""
  )
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const title = capitalize(data.title || "")
  const rawMaterial =
    data.material || ((data.metadata?.metal as string) ?? "") || ""
  const shortMaterial = capitalize(
    rawMaterial.split(/\s+with\s+/i)[0].replace(/\s*\([^)]*\)/g, "").trim()
  )

  const autoTitle = noHyphens(
    shortMaterial
      ? `${title}, ${shortMaterial} | ${BRAND.productSuffix}`
      : `${title} | ${BRAND.productSuffix}`
  )
  const autoDescription = noHyphens(
    data.description
      ? trimMeta(data.description)
      : `Shop ${title} from ${BRAND.name}. ${BRAND.tagline}. Free shipping on orders above ₹5,000.`
  )

  const seoTitle = seoTitleOverride.trim() || autoTitle
  const seoDescription = seoDescOverride.trim() || autoDescription

  const persist = async (patch: Record<string, unknown>) => {
    const res = await fetch(`/admin/products/${data.id}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metadata: { ...(data.metadata || {}), ...patch },
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || "Failed to save")
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await persist({
        seo_title: seoTitleOverride.trim() || null,
        seo_description: seoDescOverride.trim() || null,
      })
      toast.success("SEO fields saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleImageFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append("files", file)

      const up = await fetch(`/admin/uploads`, {
        method: "POST",
        credentials: "include",
        body: form,
      })
      const json = await up.json()
      if (!up.ok) throw new Error(json.message || "Upload failed")

      const url: string | undefined = json.files?.[0]?.url
      if (!url) throw new Error("No file URL returned")

      await persist({ seo_image: url })
      setSeoImage(url)
      toast.success("Meta image uploaded")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleRemoveImage = async () => {
    setUploading(true)
    try {
      await persist({ seo_image: null })
      setSeoImage("")
      toast.success("Meta image removed")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove")
    } finally {
      setUploading(false)
    }
  }

  const handle = data.handle || ""
  const hasThumbnail = Boolean(data.thumbnail)
  const tagCount = data.tags?.length ?? 0
  const categoryCount = (data as any).categories?.length ?? 0
  const descLen = (data.description || "").trim().length

  const checks: Check[] = [
    {
      label: "Meta title length",
      status:
        seoTitle.length >= 30 && seoTitle.length <= 60
          ? "good"
          : seoTitle.length >= 20 && seoTitle.length <= 65
            ? "warn"
            : "bad",
      hint: `${seoTitle.length} chars (aim 30–60)`,
    },
    {
      label: "Meta description length",
      status:
        seoDescription.length >= 70 && seoDescription.length <= 160
          ? "good"
          : seoDescription.length >= 50
            ? "warn"
            : "bad",
      hint: `${seoDescription.length} chars (aim 70–160)`,
    },
    {
      label: "Meta image",
      status: seoImage ? "good" : hasThumbnail ? "warn" : "bad",
      hint: seoImage
        ? "Custom image set"
        : hasThumbnail
          ? "Falls back to product thumbnail"
          : "Missing — add a thumbnail or a meta image",
    },
    {
      label: "Product description",
      status: descLen >= 120 ? "good" : descLen >= 40 ? "warn" : "bad",
      hint:
        descLen >= 120 ? "Detailed" : descLen > 0 ? "A bit short — add detail" : "Missing",
    },
    {
      label: "Category",
      status: categoryCount >= 1 ? "good" : "bad",
      hint: categoryCount >= 1 ? "Assigned" : "Assign a category",
    },
    {
      label: "Tags",
      status: tagCount >= 3 ? "good" : tagCount >= 1 ? "warn" : "bad",
      hint: `${tagCount} tag${tagCount === 1 ? "" : "s"} (3+ ideal)`,
    },
    {
      label: "URL handle",
      status:
        handle && handle.length <= 60 && /^[a-z0-9-]+$/.test(handle)
          ? "good"
          : handle
            ? "warn"
            : "bad",
      hint: handle ? `/${handle}` : "Missing",
    },
  ]

  const score = Math.round(
    (checks.reduce(
      (sum, c) => sum + (c.status === "good" ? 1 : c.status === "warn" ? 0.5 : 0),
      0
    ) /
      checks.length) *
      100
  )
  const scoreStatus: Status = score >= 80 ? "good" : score >= 55 ? "warn" : "bad"
  const scoreLabel = score >= 80 ? "Good" : score >= 55 ? "Needs work" : "Poor"

  const dirty =
    seoTitleOverride !== (typeof meta.seo_title === "string" ? meta.seo_title : "") ||
    seoDescOverride !== (typeof meta.seo_description === "string" ? meta.seo_description : "")

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">SEO</Heading>
        <Badge size="2xsmall" color={seoTitleOverride || seoDescOverride ? "green" : "grey"}>
          {seoTitleOverride || seoDescOverride ? "Custom" : "Auto-generated"}
        </Badge>
      </div>

      {/* Score */}
      <div className="px-6 py-4 flex items-center gap-4">
        <div
          className="flex items-center justify-center shrink-0 rounded-full text-white font-semibold"
          style={{ width: 56, height: 56, fontSize: 16, background: FILL[scoreStatus] }}
        >
          {score}
        </div>
        <div className="flex flex-col">
          <Text size="base" weight="plus" style={{ color: ACCENT[scoreStatus] }}>
            {scoreLabel}
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            SEO score {score}/100 — based on the checks below
          </Text>
        </div>
      </div>

      {/* Editable fields */}
      <div className="px-6 py-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label size="small">Meta title</Label>
          <Input
            value={seoTitleOverride}
            placeholder={autoTitle}
            onChange={(e) => setSeoTitleOverride(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label size="small">Meta description</Label>
          <Textarea
            rows={3}
            value={seoDescOverride}
            placeholder={autoDescription}
            onChange={(e) => setSeoDescOverride(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button size="small" disabled={saving || !dirty} onClick={handleSave}>
            {saving ? "Saving…" : "Save SEO fields"}
          </Button>
        </div>
        <Text size="xsmall" className="text-ui-fg-muted">
          Leave blank to use the auto-generated title/description shown below.
        </Text>
      </div>

      {/* Meta image */}
      <div className="px-6 py-4 flex flex-col gap-3">
        <Label size="small">Meta image (social share / OG image)</Label>
        <div className="flex items-center gap-3">
          {seoImage ? (
            <img
              src={seoImage}
              alt="Meta"
              style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-lg bg-ui-bg-subtle text-ui-fg-muted"
              style={{ width: 72, height: 72 }}
            >
              <Text size="xsmall">None</Text>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="small"
              variant="secondary"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : seoImage ? "Replace" : "Upload image"}
            </Button>
            {seoImage && (
              <Button
                size="small"
                variant="danger"
                disabled={uploading}
                onClick={handleRemoveImage}
              >
                Remove
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => handleImageFile(e.target.files)}
          />
        </div>
        <Text size="xsmall" className="text-ui-fg-muted">
          Falls back to the product thumbnail when not set.
        </Text>
      </div>

      {/* Google-style preview */}
      <div className="px-6 py-4">
        <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
          <Text size="xsmall" className="text-ui-fg-muted">
            {`delfee.in › products › ${handle}`}
          </Text>
          <Text
            size="base"
            weight="plus"
            className="text-ui-fg-interactive mt-0.5"
          >
            {seoTitle}
          </Text>
          <Text size="small" className="text-ui-fg-subtle mt-0.5">
            {seoDescription}
          </Text>
        </div>
      </div>

      {/* Checklist */}
      <div className="px-6 py-4 flex flex-col gap-2.5">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-3">
            <span
              className="shrink-0 rounded-full"
              style={{ width: 9, height: 9, background: ACCENT[c.status] }}
            />
            <Text size="small" className="text-ui-fg-base flex-1">
              {c.label}
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {c.hint}
            </Text>
          </div>
        ))}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductSeoPreviewWidget
