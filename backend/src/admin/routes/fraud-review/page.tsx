import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ShieldCheck } from "@medusajs/icons"
import { Container, Heading, Badge, Text, Button, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

type Flagged = {
  order_id: string
  display_id: number | null
  email: string | null
  currency_code: string
  total: number
  score: number
  band: "low" | "review" | "high"
  reasons: string[]
  checked_at: string
  created_at: string
  items: { title: string; quantity: number }[]
}

const fmt = (amount: number, cc: string) => {
  const sym = cc?.toLowerCase() === "inr" ? "₹" : ""
  return `${sym}${Number(amount || 0).toLocaleString("en-IN")}`
}

const bandColor = (band: string): "red" | "orange" | "grey" =>
  band === "high" ? "red" : band === "review" ? "orange" : "grey"

const FraudReviewPage = () => {
  const [rows, setRows] = useState<Flagged[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    fetch("/admin/fraud-review", { credentials: "include" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
        setRows(body.flagged || [])
      })
      .catch((e) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const clear = async (id: string) => {
    if (
      !window.confirm(
        "Mark this order as safe? It will be removed from the review queue."
      )
    )
      return
    setBusy(id)
    try {
      const r = await fetch(`/admin/fraud-review/${id}/clear`, {
        method: "POST",
        credentials: "include",
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
      toast.success("Order cleared — removed from review.")
      load()
    } catch (e: any) {
      toast.error(e?.message || "Clear failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <Container>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <Heading level="h1">Orders to Review</Heading>
            <Text size="small" style={{ color: "var(--fg-subtle)", marginTop: 4 }}>
              Orders flagged by the fraud-risk engine. Review each before
              fulfilment — open the order to cancel/refund, or clear it as safe.
            </Text>
          </div>
          <Button variant="secondary" size="small" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>

        {loading && <Text size="small">Loading…</Text>}
        {error && (
          <Text size="small" style={{ color: "#b91c1c" }}>
            {error}
          </Text>
        )}

        {!loading && !error && rows.length === 0 && (
          <div
            style={{
              padding: "28px 16px",
              borderRadius: 12,
              background: "var(--tag-green-bg)",
              border: "1px solid var(--tag-green-border)",
              textAlign: "center",
            }}
          >
            <Text style={{ color: "var(--tag-green-text)", fontWeight: 600 }}>
              ✓ All clear — no orders need review.
            </Text>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((f) => (
            <div
              key={f.order_id}
              style={{
                padding: 16,
                borderRadius: 12,
                border: "1px solid var(--border-base)",
                background: "var(--bg-base)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Text style={{ fontWeight: 700, color: "var(--fg-base)" }}>
                      {f.display_id ? `#${f.display_id}` : "Order"} ·{" "}
                      {fmt(f.total, f.currency_code)}
                    </Text>
                    <Badge color={bandColor(f.band)} size="2xsmall">
                      {f.band === "high" ? "High risk" : "Review"} · {f.score}
                    </Badge>
                  </div>
                  <Text size="small" style={{ color: "var(--fg-subtle)", marginTop: 2 }}>
                    {f.email || "(guest)"} ·{" "}
                    {new Date(f.created_at).toLocaleString("en-IN")}
                  </Text>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <a href={`/app/orders/${f.order_id}`} target="_blank" rel="noreferrer">
                    <Button size="small" variant="secondary">
                      Open order
                    </Button>
                  </a>
                  <Button
                    size="small"
                    onClick={() => clear(f.order_id)}
                    disabled={busy === f.order_id}
                  >
                    {busy === f.order_id ? "Working…" : "Mark safe"}
                  </Button>
                </div>
              </div>

              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--fg-subtle)",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border-base)",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                <div>
                  <strong>Risk reasons:</strong>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {f.reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
                {f.items.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <strong>Items:</strong>{" "}
                    {f.items.map((i) => `${i.title} ×${i.quantity}`).join(", ")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Orders to Review",
  icon: ShieldCheck,
})

export default FraudReviewPage
