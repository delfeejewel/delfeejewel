import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProduct } from "@medusajs/types"
import { Button, Container, Heading, Input, Text, toast } from "@medusajs/ui"
import { useMemo, useState } from "react"

/**
 * "Cost price" card — what this variant costs YOU, stored in
 * `variant.metadata.cost_price` (₹, GST-exclusive).
 *
 * Feeds the per-order margin breakdown on the order page. Orders containing a
 * variant with no cost set say so explicitly rather than assuming a figure —
 * a profit number built on a guess is worse than no profit number.
 *
 * Never shown to customers anywhere.
 */

type DetailWidgetProps = { data: AdminProduct }

const formatAmount = (raw: unknown): string => {
  if (raw === null || raw === undefined || raw === "") return ""
  const n = Number(String(raw).replace(/,/g, ""))
  return Number.isFinite(n) && n > 0 ? String(n) : ""
}

const ProductCostPrice = ({ data }: DetailWidgetProps) => {
  const variants = useMemo(() => data.variants || [], [data.variants])

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (data.variants || []).map((v) => [
        v.id,
        formatAmount((v.metadata as Record<string, unknown> | null)?.cost_price),
      ])
    )
  )
  const [savingId, setSavingId] = useState<string | null>(null)

  const save = async (variantId: string) => {
    const raw = (values[variantId] ?? "").trim()

    let cost: number | null = null
    if (raw !== "") {
      const n = Number(raw.replace(/,/g, ""))
      if (!Number.isFinite(n) || n <= 0) {
        toast.error("Enter a positive amount, or leave it blank to clear.")
        return
      }
      cost = n
    }

    const variant = variants.find((v) => v.id === variantId)
    const price = (variant as any)?.calculated_price?.calculated_amount

    // A cost above the selling price is usually a typo, but it is also a real
    // situation (clearance). Warn, don't block.
    if (cost !== null && typeof price === "number" && cost > price) {
      toast.warning(
        `Cost ₹${cost} is higher than the selling price ₹${price} — this variant would sell at a loss.`
      )
    }

    setSavingId(variantId)
    try {
      const existing =
        (variants.find((v) => v.id === variantId)?.metadata as Record<
          string,
          unknown
        > | null) || {}

      const res = await fetch(
        `/admin/products/${data.id}/variants/${variantId}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Merge: variant metadata also carries the MRP and other flags,
            // and a bare object would wipe them.
            metadata: { ...existing, cost_price: cost },
          }),
        }
      )
      if (!res.ok) throw new Error(await res.text())
      toast.success(cost === null ? "Cost cleared" : `Cost saved: ₹${cost}`)
    } catch (e: any) {
      toast.error(`Could not save: ${e?.message || "unknown error"}`)
    } finally {
      setSavingId(null)
    }
  }

  if (!variants.length) return null

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Cost price</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Internal only
        </Text>
      </div>

      <div className="px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle mb-4">
          What each variant costs you, excluding GST. Used for the profit
          breakdown on orders. Leave blank if unknown — orders will say the cost
          is missing rather than assume one.
        </Text>

        <div className="flex flex-col gap-3">
          {variants.map((v) => {
            const price = (v as any)?.calculated_price?.calculated_amount
            const costNum = Number((values[v.id] ?? "").replace(/,/g, ""))
            const margin =
              Number.isFinite(costNum) &&
              costNum > 0 &&
              typeof price === "number" &&
              price > 0
                ? ((price - costNum) / price) * 100
                : null

            return (
              <div key={v.id} className="flex items-center gap-3">
                <Text size="small" className="w-40 truncate">
                  {v.title || "Default"}
                </Text>
                <Input
                  placeholder="Cost ₹"
                  value={values[v.id] ?? ""}
                  onChange={(e) =>
                    setValues((s) => ({ ...s, [v.id]: e.target.value }))
                  }
                  className="max-w-[140px]"
                />
                <Text size="small" className="text-ui-fg-subtle w-44">
                  {typeof price === "number" ? `sells at ₹${price}` : ""}
                  {margin !== null ? ` · ${margin.toFixed(0)}% margin` : ""}
                </Text>
                <Button
                  size="small"
                  variant="secondary"
                  isLoading={savingId === v.id}
                  onClick={() => save(v.id)}
                >
                  Save
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductCostPrice
