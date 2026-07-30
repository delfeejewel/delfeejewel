import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProduct } from "@medusajs/types"
import { Button, Container, Heading, Input, Text, toast } from "@medusajs/ui"
import { useMemo, useState } from "react"

/**
 * "Compare-at price (MRP)" card — one figure per variant, stored in
 * `variant.metadata.mrp`.
 *
 * The storefront strikes this through next to the selling price (product page,
 * listings, search, carousels) and shows the resulting "Save X%" badge. It only
 * renders when it is higher than what's actually being charged, and a real
 * Medusa price-list sale always takes precedence over it.
 *
 * Leave it blank to show no struck price at all.
 *
 * This must be a price the product is genuinely offered at — an inflated
 * figure that was never charged is a fictitious reference price, which the
 * CCPA's misleading-advertisement rules prohibit.
 */

type DetailWidgetProps = { data: AdminProduct }

const formatAmount = (raw: unknown): string => {
  if (raw === null || raw === undefined || raw === "") return ""
  const n = Number(String(raw).replace(/,/g, ""))
  return Number.isFinite(n) && n > 0 ? String(n) : ""
}

const ProductCompareAtPrice = ({ data }: DetailWidgetProps) => {
  const variants = useMemo(() => data.variants || [], [data.variants])

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (data.variants || []).map((v) => [
        v.id,
        formatAmount((v.metadata as Record<string, unknown> | null)?.mrp),
      ])
    )
  )
  const [savingId, setSavingId] = useState<string | null>(null)

  const save = async (variantId: string) => {
    const raw = (values[variantId] ?? "").trim()

    // Empty clears the field; anything else must be a positive number.
    let mrp: number | null = null
    if (raw !== "") {
      const n = Number(raw.replace(/,/g, ""))
      if (!Number.isFinite(n) || n <= 0) {
        toast.error("Enter a positive amount, or leave it blank to clear.")
        return
      }
      mrp = n
    }

    const variant = variants.find((v) => v.id === variantId)
    const price = variant?.calculated_price?.calculated_amount

    if (mrp !== null && typeof price === "number" && mrp <= price) {
      toast.error(
        `Compare-at price must be above the selling price (${price}). It won't be shown otherwise.`
      )
      return
    }

    setSavingId(variantId)
    try {
      const res = await fetch(
        `/admin/products/${data.id}/variants/${variantId}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metadata: { ...((variant?.metadata as object) || {}), mrp },
          }),
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || "Failed to save")
      }
      toast.success(mrp === null ? "Compare-at price cleared" : "Compare-at price saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSavingId(null)
    }
  }

  if (!variants.length) return null

  return (
    <Container className="p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Compare-at price (MRP)</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Shown struck through next to the selling price, with a “Save X%”
          badge. Must be higher than the selling price, and must be a price this
          product is genuinely offered at. Leave blank for no struck price.
        </Text>
      </div>

      <div className="border-t border-ui-border-base">
        {variants.map((v) => {
          const price = v.calculated_price?.calculated_amount
          return (
            <div
              key={v.id}
              className="flex items-center gap-4 border-b border-ui-border-base px-6 py-3 last:border-b-0"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <Text size="small" weight="plus" className="truncate">
                  {v.title}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {v.sku ? `${v.sku} · ` : ""}
                  {typeof price === "number" ? `Selling at ${price}` : "No price set"}
                </Text>
              </div>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="—"
                className="w-32"
                value={values[v.id] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [v.id]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") save(v.id)
                }}
              />
              <Button
                size="small"
                variant="secondary"
                isLoading={savingId === v.id}
                disabled={!!savingId}
                onClick={() => save(v.id)}
              >
                Save
              </Button>
            </div>
          )
        })}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductCompareAtPrice
