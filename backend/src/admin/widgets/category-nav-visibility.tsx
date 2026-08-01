import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProductCategory } from "@medusajs/types"
import { Container, Heading, Text, Checkbox, Badge } from "@medusajs/ui"
import { useState, useCallback } from "react"

/**
 * "Navigation visibility" — pick which storefront surfaces a category shows on.
 *
 * Mirrors backend/src/api/admin/categories/[id]/nav-visibility/route.ts and the
 * storefront's lib/util/category-visibility. A missing flag means VISIBLE, so
 * every checkbox defaults to checked and only an explicit uncheck hides it.
 */

type DetailWidgetProps = {
  data: AdminProductCategory
}

const SURFACES = [
  {
    key: "show_in_header",
    label: "Header navigation",
    hint: "The category bar across the top of every page (desktop).",
  },
  {
    key: "show_in_mobile",
    label: "Mobile menu",
    hint: "The slide-out drawer behind the hamburger icon.",
  },
  {
    key: "show_in_footer",
    label: "Footer navigation",
    hint: "The “Shop by Category” column in the site footer.",
  },
  {
    key: "show_in_tiles",
    label: "Category tiles",
    hint: "The image cards on the homepage and the store page. Needs a cover image.",
    needsCover: true,
  },
] as const

const CategoryNavVisibilityWidget = ({ data }: DetailWidgetProps) => {
  const metadata = (data.metadata || {}) as Record<string, unknown>

  // Legacy key: `show_in_tiles` replaced `hide_from_homepage`. Honour the old
  // one until it's cleared, so the checkbox reflects what the storefront does.
  const initial: Record<string, boolean> = {}
  for (const s of SURFACES) {
    const legacyOff = s.key === "show_in_tiles" && metadata.hide_from_homepage === true
    initial[s.key] = metadata[s.key] !== false && !legacyOff
  }

  const [values, setValues] = useState(initial)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasCover =
    typeof metadata.cover_image === "string" &&
    (metadata.cover_image as string).trim() !== ""

  const toggle = useCallback(
    async (key: string, next: boolean) => {
      const previous = values[key]
      setValues((v) => ({ ...v, [key]: next }))
      setSaving(key)
      setError(null)

      try {
        const response = await fetch(
          `/admin/categories/${data.id}/nav-visibility`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [key]: next }),
          }
        )
        if (!response.ok) {
          const result = await response.json().catch(() => ({}))
          throw new Error(result.message || "Failed to save")
        }
      } catch (e: any) {
        // Roll the checkbox back so it never shows a state that wasn't saved.
        setValues((v) => ({ ...v, [key]: previous }))
        setError(e.message || "Failed to save")
      } finally {
        setSaving(null)
      }
    },
    [data.id, values]
  )

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Navigation visibility</Heading>
      </div>

      <div className="px-6 py-4 flex flex-col gap-y-4">
        <Text size="small" className="text-ui-fg-subtle">
          Where this category is listed on the storefront. Unchecking hides it
          from that surface only — the category page itself stays reachable.
        </Text>

        {SURFACES.map((s) => {
          const checked = values[s.key]
          const coverMissing = s.needsCover && checked && !hasCover
          return (
            <div key={s.key} className="flex items-start gap-x-3">
              <Checkbox
                id={`nav-${s.key}`}
                checked={checked}
                disabled={saving === s.key}
                onCheckedChange={(v) => toggle(s.key, v === true)}
              />
              <div className="flex flex-col gap-y-1">
                <label
                  htmlFor={`nav-${s.key}`}
                  className="text-ui-fg-base txt-small font-medium cursor-pointer"
                >
                  {s.label}
                  {saving === s.key && (
                    <span className="text-ui-fg-muted"> — saving…</span>
                  )}
                </label>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {s.hint}
                </Text>
                {coverMissing && (
                  <Badge color="orange" size="2xsmall">
                    No cover image — this category will not appear as a tile
                    until you upload one
                  </Badge>
                )}
              </div>
            </div>
          )
        })}

        {error && (
          <Text size="small" className="text-ui-fg-error">
            {error}
          </Text>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product_category.details.side.before",
})

export default CategoryNavVisibilityWidget
