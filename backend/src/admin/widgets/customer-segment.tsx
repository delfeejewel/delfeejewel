import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Badge, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"

type Segment = "new" | "repeat" | "regular"

type SegmentData = {
  customer_id: string
  completed_order_count: number
  total_spent: number
  last_order_at: string | null
  segment: Segment
}

const SEGMENT_LABEL: Record<Segment, string> = {
  new: "New",
  repeat: "Repeat",
  regular: "Regular",
}

const SEGMENT_COLOR: Record<Segment, "blue" | "green" | "purple"> = {
  new: "blue",
  repeat: "green",
  regular: "purple",
}

const CustomerSegmentWidget = ({ data }: { data: { id: string } }) => {
  const [seg, setSeg] = useState<SegmentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/admin/customers/${data.id}/segment`, { credentials: "include" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
        if (!cancelled) setSeg(body as SegmentData)
      })
      .catch((e) => !cancelled && setError(e?.message || "Failed to load"))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [data.id])

  return (
    <Container>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <Heading level="h2">Segment</Heading>
        {loading && <Text size="small">Loading…</Text>}
        {error && (
          <Text size="small" style={{ color: "#b91c1c" }}>
            {error}
          </Text>
        )}
        {seg && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Badge color={SEGMENT_COLOR[seg.segment]}>
                {SEGMENT_LABEL[seg.segment]}
              </Badge>
              <Text size="small" style={{ color: "#6b7280" }}>
                {seg.completed_order_count}{" "}
                {seg.completed_order_count === 1 ? "order" : "orders"}
              </Text>
            </div>
            {seg.last_order_at && (
              <Text size="xsmall" style={{ color: "#9ca3af" }}>
                Last order {new Date(seg.last_order_at).toLocaleDateString()}
              </Text>
            )}
          </>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "customer.details.side.before",
})

export default CustomerSegmentWidget
