import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProduct } from "@medusajs/types"
import { Container, Heading, Switch, Text, toast } from "@medusajs/ui"
import { useState } from "react"

/**
 * "Gift ready" toggle. Stored in product.metadata.gift_ready. When ON, the
 * storefront product page shows the "Gift Ready" badge and the gift-wrap
 * option ("Is this a Gift? Wrap it for ₹50"); when OFF, both are hidden.
 */

type DetailWidgetProps = { data: AdminProduct }

const ProductGiftReadyWidget = ({ data }: DetailWidgetProps) => {
  const [giftReady, setGiftReady] = useState(
    !!(data.metadata as Record<string, unknown> | null)?.gift_ready
  )
  const [saving, setSaving] = useState(false)

  const toggle = async (next: boolean) => {
    setSaving(true)
    try {
      const res = await fetch(`/admin/products/${data.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: { ...(data.metadata || {}), gift_ready: next },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || "Failed to save")
      }
      setGiftReady(next)
      toast.success(next ? "Marked as gift ready" : "Gift ready turned off")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="p-0">
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div className="flex flex-col">
          <Heading level="h2">Gift ready 🎁</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            When on, the storefront shows the “Gift Ready” badge and the
            “Wrap it for ₹50” gift option on this product.
          </Text>
        </div>
        <Switch
          checked={giftReady}
          disabled={saving}
          onCheckedChange={toggle}
          className="mt-1 shrink-0"
        />
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side.after",
})

export default ProductGiftReadyWidget
