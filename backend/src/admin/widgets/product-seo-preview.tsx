import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProduct } from "@medusajs/types"
import { Container, Heading, Text, Badge } from "@medusajs/ui"

/**
 * SEO Preview + Score for a product. Medusa has no native SEO fields, so this
 * read-only widget shows the title/description the storefront generates (mirrors
 * products/[handle]/page.tsx -> generateMetadata) and grades the product's SEO
 * readiness with a 0-100 score + checklist.
 *
 * Colours use Medusa UI theme tokens (bg-ui-*, text-ui-*) so contrast holds in
 * both light and dark admin themes. Keep brand values in sync with the
 * storefront's constants.brand.ts.
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
  const title = capitalize(data.title || "")
  const rawMaterial =
    data.material || ((data.metadata?.metal as string) ?? "") || ""
  const shortMaterial = capitalize(
    rawMaterial.split(/\s+with\s+/i)[0].replace(/\s*\([^)]*\)/g, "").trim()
  )

  const seoTitle = noHyphens(
    shortMaterial
      ? `${title}, ${shortMaterial} | ${BRAND.productSuffix}`
      : `${title} | ${BRAND.productSuffix}`
  )
  const seoDescription = noHyphens(
    data.description
      ? trimMeta(data.description)
      : `Shop ${title} from ${BRAND.name}. ${BRAND.tagline}. Free shipping on orders above ₹999.`
  )

  const handle = data.handle || ""
  const imageCount = data.images?.length ?? 0
  const tagCount = data.tags?.length ?? 0
  const categoryCount = (data as any).categories?.length ?? 0
  const descLen = (data.description || "").trim().length

  const checks: Check[] = [
    {
      label: "Title length",
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
      label: "Product description",
      status: descLen >= 120 ? "good" : descLen >= 40 ? "warn" : "bad",
      hint:
        descLen >= 120 ? "Detailed" : descLen > 0 ? "A bit short — add detail" : "Missing",
    },
    {
      label: "Images",
      status: imageCount >= 3 ? "good" : imageCount >= 1 ? "warn" : "bad",
      hint: `${imageCount} image${imageCount === 1 ? "" : "s"} (3+ ideal)`,
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
      label: "Subtitle",
      status: data.subtitle ? "good" : "warn",
      hint: data.subtitle ? "Present" : "Optional but helps",
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

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">SEO</Heading>
        <Badge size="2xsmall" color="grey">
          Auto-generated
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
        <Text size="xsmall" className="text-ui-fg-muted mt-1">
          Read-only. Improve the score by editing the product&apos;s Title,
          Material, Description, Tags, Category and Images.
        </Text>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductSeoPreviewWidget
