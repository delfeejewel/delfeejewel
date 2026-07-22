import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Badge, Text, Button } from "@medusajs/ui"
import { useEffect, useState } from "react"

const STAGES = ["pending", "picked", "packed", "awb_assigned", "handed_over"] as const
type OpsStatus = typeof STAGES[number]

const STAGE_LABEL: Record<OpsStatus, string> = {
  pending: "Pending pick",
  picked: "Picked",
  packed: "Packed",
  awb_assigned: "AWB assigned",
  handed_over: "Handed over",
}

const STAGE_HINT: Record<OpsStatus, string> = {
  pending: "Order placed, awaiting picker.",
  picked: "Items pulled from inventory and assembled.",
  packed: "Securely packed; gift wrap applied if requested.",
  awb_assigned: "Shiprocket AWB generated and label printed.",
  handed_over: "Handed off to the courier — Shiprocket tracks from here.",
}

type HistoryEntry = {
  status: OpsStatus
  at: string
  actor_id?: string | null
  actor_email?: string | null
}

type ApiResponse = {
  status: OpsStatus
  history: HistoryEntry[]
  gift_wrap: boolean
  gift_wrappers_used: number | null
}

const OrderOpsStatusWidget = ({ data }: { data: { id: string } }) => {
  const [state, setState] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<OpsStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Wrapper count the packer types in before marking the order packed.
  const [wrappers, setWrappers] = useState("1")

  const load = () => {
    setLoading(true)
    setError(null)
    fetch(`/admin/orders/${data.id}/ops-status`, { credentials: "include" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
        setState(body as ApiResponse)
      })
      .catch((e) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [data.id])

  const advanceTo = async (target: OpsStatus) => {
    setSaving(target)
    setError(null)
    try {
      const r = await fetch(`/admin/orders/${data.id}/ops-status`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: target,
          // Only sent for the packing step of a gift-wrapped order; the server
          // rejects that step without it.
          ...(needsWrapperCount && target === "packed"
            ? { gift_wrappers_used: Number(wrappers) }
            : {}),
        }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
      // Reload to refresh history
      load()
    } catch (e: any) {
      setError(e?.message || "Could not update status")
    } finally {
      setSaving(null)
    }
  }

  // Ask for the count only while it is still unrecorded — once deducted, the
  // number is shown as a fact rather than re-collected.
  const needsWrapperCount = !!state?.gift_wrap && state?.gift_wrappers_used == null

  const currentIdx = state ? STAGES.indexOf(state.status) : -1
  const nextStage =
    currentIdx >= 0 && currentIdx < STAGES.length - 1
      ? STAGES[currentIdx + 1]
      : null
  const lastEntry =
    state?.history && state.history.length > 0
      ? state.history[state.history.length - 1]
      : null

  const printLabelUrl = `/admin/orders/${data.id}/pick-label`

  return (
    <Container>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Heading level="h2">Fulfillment ops</Heading>
          <a
            href={printLabelUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid #5D2E46",
              color: "#5D2E46",
              textDecoration: "none",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Print pick-pack label →
          </a>
        </div>

        {state?.gift_wrap && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(212, 175, 55, 0.12)",
              border: "1px solid rgba(212, 175, 55, 0.35)",
              fontSize: 13,
              color: "#5D2E46",
              fontWeight: 600,
            }}
          >
            <div>🎁 Gift wrap requested — apply branded packaging before sealing.</div>

            {needsWrapperCount ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginTop: 10,
                  fontWeight: 500,
                }}
              >
                <label htmlFor="gift-wrappers-used">Gift wrappers used</label>
                <input
                  id="gift-wrappers-used"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={wrappers}
                  onChange={(e) => setWrappers(e.target.value)}
                  style={{
                    width: 72,
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid rgba(93, 46, 70, 0.35)",
                    fontSize: 13,
                  }}
                />
                <span style={{ fontWeight: 400, opacity: 0.75 }}>
                  deducted from wrapper stock when you mark this packed
                </span>
              </div>
            ) : (
              <div style={{ marginTop: 8, fontWeight: 400, opacity: 0.8 }}>
                {state.gift_wrappers_used} wrapper
                {state.gift_wrappers_used === 1 ? "" : "s"} used — already deducted from stock.
              </div>
            )}
          </div>
        )}

        {loading && <Text size="small">Loading…</Text>}
        {error && (
          <Text size="small" style={{ color: "#b91c1c" }}>
            {error}
          </Text>
        )}

        {state && (
          <>
            {/* Stepper */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {STAGES.map((stage, i) => {
                const isDone = i <= currentIdx
                const isCurrent = i === currentIdx
                return (
                  <div
                    key={stage}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: isCurrent
                        ? "rgba(93, 46, 70, 0.08)"
                        : isDone
                        ? "rgba(22, 163, 74, 0.06)"
                        : "transparent",
                      border: `1px solid ${
                        isCurrent
                          ? "rgba(93, 46, 70, 0.3)"
                          : isDone
                          ? "rgba(22, 163, 74, 0.2)"
                          : "rgba(0, 0, 0, 0.08)"
                      }`,
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: isDone ? "#15803d" : isCurrent ? "#5D2E46" : "transparent",
                        border: isDone || isCurrent ? "none" : "1.5px solid #cbd5e1",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isDone && !isCurrent ? "✓" : i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a1a" }}>
                        {STAGE_LABEL[stage]}
                      </div>
                      <div style={{ fontSize: 11.5, color: "#666", marginTop: 1 }}>
                        {STAGE_HINT[stage]}
                      </div>
                    </div>
                    {isCurrent && <Badge color="purple">Current</Badge>}
                  </div>
                )
              })}
            </div>

            {/* Action */}
            {nextStage ? (
              <Button
                size="base"
                onClick={() => advanceTo(nextStage)}
                disabled={!!saving}
                style={{ alignSelf: "flex-start" }}
              >
                {saving === nextStage ? "Saving…" : `Mark as ${STAGE_LABEL[nextStage]}`}
              </Button>
            ) : (
              <Badge color="green">All operational stages complete</Badge>
            )}

            {/* Last update */}
            {lastEntry && (
              <Text size="xsmall" style={{ color: "#9ca3af" }}>
                Last update {new Date(lastEntry.at).toLocaleString("en-IN")}{" "}
                {lastEntry.actor_email ? `by ${lastEntry.actor_email}` : ""}
              </Text>
            )}

            {/* History (collapsible) */}
            {state.history.length > 1 && (
              <details style={{ fontSize: 12 }}>
                <summary
                  style={{
                    cursor: "pointer",
                    color: "#5D2E46",
                    fontWeight: 600,
                    padding: "4px 0",
                  }}
                >
                  Full history ({state.history.length} entries)
                </summary>
                <ol
                  style={{
                    listStyle: "none",
                    padding: "8px 0 0",
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {state.history
                    .slice()
                    .reverse()
                    .map((h, i) => (
                      <li
                        key={i}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          background: "#faf8f3",
                          fontSize: 11.5,
                          color: "#1a1a1a",
                        }}
                      >
                        <strong>{STAGE_LABEL[h.status] || h.status}</strong>{" "}
                        — {new Date(h.at).toLocaleString("en-IN")}
                        {h.actor_email && (
                          <span style={{ color: "#666" }}> · {h.actor_email}</span>
                        )}
                      </li>
                    ))}
                </ol>
              </details>
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

export default OrderOpsStatusWidget
