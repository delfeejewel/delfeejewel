import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Users } from "@medusajs/icons"
import { Container, Heading, Badge, Text, Button } from "@medusajs/ui"
import { useEffect, useState } from "react"

type Subscriber = {
  id: string
  email: string
  status: "subscribed" | "unsubscribed"
  source: string | null
  created_at: string
}

const NewsletterPage = () => {
  const [rows, setRows] = useState<Subscriber[]>([])
  const [totals, setTotals] = useState({ subscribed: 0, unsubscribed: 0 })
  const [filter, setFilter] = useState<"" | "subscribed" | "unsubscribed">("")
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch(`/admin/newsletter/subscribers${filter ? `?status=${filter}` : ""}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        setRows(d.subscribers || [])
        setTotals(d.totals || { subscribed: 0, unsubscribed: 0 })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [filter])

  return (
    <Container>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <Heading level="h1">Newsletter Subscribers</Heading>
          <Text size="small" style={{ color: "var(--fg-subtle)", marginTop: 4 }}>
            {totals.subscribed} subscribed · {totals.unsubscribed} unsubscribed
          </Text>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {([["", "All"], ["subscribed", "Subscribed"], ["unsubscribed", "Unsubscribed"]] as const).map(
            ([v, l]) => (
              <Button
                key={v}
                size="small"
                variant={filter === v ? "primary" : "secondary"}
                onClick={() => setFilter(v as any)}
              >
                {l}
              </Button>
            )
          )}
        </div>

        {loading && <Text size="small">Loading…</Text>}
        {!loading && !rows.length && (
          <Text size="small" style={{ color: "var(--fg-subtle)" }}>No subscribers yet.</Text>
        )}

        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((s) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                borderBottom: "1px solid var(--border-base)",
              }}
            >
              <div>
                <Text size="small">{s.email}</Text>
                <Text size="xsmall" style={{ color: "var(--fg-subtle)" }}>
                  {s.source || "—"} · {new Date(s.created_at).toLocaleDateString("en-IN")}
                </Text>
              </div>
              <Badge color={s.status === "subscribed" ? "green" : "grey"} size="2xsmall">
                {s.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Subscribers",
  icon: Users,
})

export default NewsletterPage
