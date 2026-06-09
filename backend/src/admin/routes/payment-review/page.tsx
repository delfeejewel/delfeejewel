import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ExclamationCircle } from "@medusajs/icons"
import { Container, Heading, Badge, Text, Button, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

type Flagged = {
  cart_id: string
  email: string | null
  currency_code: string
  amount: number
  is_cod_token: boolean
  payment_id: string | null
  reason: string
  flagged_at: string
  items: { title: string; quantity: number }[]
}

const fmt = (amount: number, cc: string) => {
  const sym = cc?.toLowerCase() === "inr" ? "₹" : ""
  return `${sym}${Number(amount || 0).toLocaleString("en-IN")}`
}

const PaymentReviewPage = () => {
  const [rows, setRows] = useState<Flagged[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    fetch("/admin/flagged-carts", { credentials: "include" })
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

  const retry = async (id: string) => {
    setBusy(id)
    try {
      const r = await fetch(`/admin/flagged-carts/${id}/retry`, {
        method: "POST",
        credentials: "include",
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
      if (body.status === "completed" || body.status === "already_order") {
        toast.success("Order created — removed from review.")
      } else {
        toast.warning(`Still couldn't complete: ${body.status}`)
      }
      load()
    } catch (e: any) {
      toast.error(e?.message || "Retry failed")
    } finally {
      setBusy(null)
    }
  }

  const dismiss = async (id: string) => {
    if (
      !window.confirm(
        "Dismiss this flag? Do this only after you've refunded or handled the payment manually."
      )
    )
      return
    setBusy(id)
    try {
      const r = await fetch(`/admin/flagged-carts/${id}/dismiss`, {
        method: "POST",
        credentials: "include",
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body?.message || `HTTP ${r.status}`)
      }
      toast.success("Dismissed.")
      load()
    } catch (e: any) {
      toast.error(e?.message || "Dismiss failed")
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
            <Heading level="h1">Payments to Review</Heading>
            <Text size="small" style={{ color: "var(--fg-subtle)", marginTop: 4 }}>
              Captured payments whose order could not be created automatically.
              Retry to place the order, or dismiss after refunding manually.
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
              ✓ All clear — no payments need review.
            </Text>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((f) => (
            <div
              key={f.cart_id}
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
                      {fmt(f.amount, f.currency_code)} captured
                    </Text>
                    <Badge color={f.is_cod_token ? "orange" : "blue"} size="2xsmall">
                      {f.is_cod_token ? "COD token" : "Online"}
                    </Badge>
                  </div>
                  <Text size="small" style={{ color: "var(--fg-subtle)", marginTop: 2 }}>
                    {f.email || "(guest)"} ·{" "}
                    {new Date(f.flagged_at).toLocaleString("en-IN")}
                  </Text>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <Button
                    size="small"
                    onClick={() => retry(f.cart_id)}
                    disabled={busy === f.cart_id}
                  >
                    {busy === f.cart_id ? "Working…" : "Retry completion"}
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => dismiss(f.cart_id)}
                    disabled={busy === f.cart_id}
                  >
                    Dismiss
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
                  <strong>Reason:</strong> {f.reason}
                </div>
                {f.items.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <strong>Items:</strong>{" "}
                    {f.items.map((i) => `${i.title} ×${i.quantity}`).join(", ")}
                  </div>
                )}
                <div style={{ marginTop: 4, fontFamily: "monospace", fontSize: 11 }}>
                  payment: {f.payment_id || "—"} · cart: {f.cart_id}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Payments to Review",
  icon: ExclamationCircle,
})

export default PaymentReviewPage
