import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Badge, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"

type FraudData = {
  status: "none" | "needs_review" | "cleared" | "clear"
  score?: number
  band?: "low" | "review" | "high"
  reasons?: string[]
  checked_at?: string | null
  cleared_at?: string | null
}

const bandColor = (band?: string): "red" | "orange" | "green" | "grey" =>
  band === "high" ? "red" : band === "review" ? "orange" : "green"

const OrderFraudBadgeWidget = ({ data }: { data: { id: string } }) => {
  const [fraud, setFraud] = useState<FraudData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/admin/fraud-review/${data.id}`, { credentials: "include" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
        if (!cancelled) setFraud(body as FraudData)
      })
      .catch((e) => !cancelled && setError(e?.message || "Failed to load"))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [data.id])

  // Never scored → don't clutter the page with an empty card.
  if (!loading && (!fraud || fraud.status === "none")) return null

  const isFlagged = fraud?.status === "needs_review"
  const isCleared = fraud?.status === "cleared"

  return (
    <Container>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <Heading level="h2">Fraud risk</Heading>

        {loading && <Text size="small">Loading…</Text>}
        {error && (
          <Text size="small" style={{ color: "#b91c1c" }}>
            {error}
          </Text>
        )}

        {fraud && fraud.status !== "none" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Badge color={isFlagged ? bandColor(fraud.band) : "green"}>
                {isFlagged
                  ? `${fraud.band === "high" ? "High risk" : "Review"} · ${fraud.score}`
                  : isCleared
                  ? "Cleared"
                  : `Low risk · ${fraud.score ?? 0}`}
              </Badge>
              {isCleared && (
                <Text size="small" style={{ color: "#6b7280" }}>
                  marked safe
                </Text>
              )}
            </div>

            {isFlagged && (fraud.reasons?.length ?? 0) > 0 && (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 12.5,
                  color: "#6b7280",
                }}
              >
                {fraud.reasons!.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            )}

            {(fraud.cleared_at || fraud.checked_at) && (
              <Text size="xsmall" style={{ color: "#9ca3af" }}>
                {fraud.cleared_at
                  ? `Cleared ${new Date(fraud.cleared_at).toLocaleString("en-IN")}`
                  : `Checked ${new Date(fraud.checked_at!).toLocaleString("en-IN")}`}
              </Text>
            )}
          </>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
})

export default OrderFraudBadgeWidget
