import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Button } from "@medusajs/ui"
import { useEffect, useState } from "react"

type OrderInfo = {
  canceled_at: string | null
  fulfillments: { shipped_at: string | null }[]
}

const OrderCancelActionWidget = ({ data }: { data: { id: string } }) => {
  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/admin/orders/${data.id}?fields=canceled_at,fulfillments.shipped_at`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((body) => setOrder(body?.order || null))
      .catch(() => {})
  }, [data.id])

  if (!order || order.canceled_at) return null

  const shipped = (order.fulfillments || []).some((f) => f.shipped_at)
  if (shipped) return null

  const cancel = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(`/admin/orders/${data.id}/cancel-order`, {
        method: "POST",
        credentials: "include",
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
      // A blocking alert for the refund warning — this needs the admin's
      // attention before they move on, and the page reloads right after
      // (unmounting this widget) so a persistent banner wouldn't be seen.
      if (body?.refund_warning) window.alert(body.refund_warning)
      window.location.reload()
    } catch (e: any) {
      setError(e?.message || "Could not cancel this order")
      setBusy(false)
    }
  }

  return (
    <Container>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Heading level="h2">Cancel order</Heading>
        <Text size="small" style={{ color: "#666" }}>
          Cancels any active fulfillment (voiding the Shiprocket shipment if
          one exists), refunds any captured payment, and cancels the order.
          Only possible before the order has shipped.
        </Text>

        {error && (
          <Text size="small" style={{ color: "#b91c1c" }}>
            {error}
          </Text>
        )}

        {confirming ? (
          <div style={{ display: "flex", gap: 8 }}>
            <Button size="small" variant="danger" disabled={busy} onClick={cancel}>
              {busy ? "Cancelling…" : "Confirm cancel"}
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Keep order
            </Button>
          </div>
        ) : (
          <Button
            size="small"
            variant="secondary"
            style={{ alignSelf: "flex-start" }}
            onClick={() => setConfirming(true)}
          >
            Cancel Order
          </Button>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
})

export default OrderCancelActionWidget
