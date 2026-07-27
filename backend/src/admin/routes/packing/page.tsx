import { defineRouteConfig } from "@medusajs/admin-sdk"
import { TruckFast } from "@medusajs/icons"
import {
  Container,
  Heading,
  Text,
  Table,
  Badge,
  Button,
  Checkbox,
  Drawer,
  Input,
  Label,
  usePrompt,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

type QueueOrder = {
  id: string
  display_id: number
  email: string | null
  fulfillment_status: string
  item_count: number
  created_at: string
  started: boolean
  ready_to_ship: boolean
}

type Item = {
  id: string
  title: string
  variant_title: string | null
  quantity: number
  packed: boolean
}

type HistoryEntry = {
  step: string
  at: string
  actor_id: string | null
  actor_email: string | null
}

type Detail = {
  id: string
  display_id: number
  email: string | null
  fulfillment_status: string
  gift_wrap: boolean
  gift_wrappers_used: number | null
  items: Item[]
  history: HistoryEntry[]
  packing: {
    fulfillment_id: string
    started_at: string
    ready_to_ship_at: string | null
  } | null
  fulfillment: {
    id: string
    awb_code: string | null
    courier_name: string | null
    label_url: string | null
    tracking_url: string | null
    shipped_at: string | null
    pickup_requested_at: string | null
    pickup_scheduled_date: string | null
  } | null
}

const STEP_LABELS: Record<string, string> = {
  started: "Started packing",
  item_packed: "Marked an item packed",
  item_unpacked: "Unmarked an item as packed",
  awb_assigned: "Assigned the courier (AWB)",
  label_printed: "Printed the shipping label",
  ready_to_ship: "Marked ready to ship",
  pickup_requested: "Requested courier pickup",
  pickup_request_failed: "Tried to request pickup — Shiprocket didn't confirm",
  shipped: "Marked shipped",
  shiprocket_order_created: "Re-created the Shiprocket order",
  restarted_after_cancel: "Restarted packing after the previous attempt was cancelled",
  shipment_reset: "Reset the shipment (undid AWB / ready-to-ship)",
}

function historyStepLabel(step: string): string {
  if (step.startsWith("item_packed:")) return STEP_LABELS.item_packed
  if (step.startsWith("item_unpacked:")) return STEP_LABELS.item_unpacked
  return STEP_LABELS[step] || step
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return iso
  }
}

async function api(path: string, opts?: RequestInit) {
  const r = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
  return body
}

const PackingPage = () => {
  const prompt = usePrompt()
  const [queue, setQueue] = useState<QueueOrder[]>([])
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [wrapperCount, setWrapperCount] = useState("1")
  const [simulate, setSimulate] = useState(false)

  const loadQueue = () => {
    setLoadingQueue(true)
    api("/admin/packing/orders")
      .then((body) => {
        setQueue(body.orders || [])
        setSimulate(!!body.simulate)
      })
      .catch((e) => setError(e?.message || "Failed to load queue"))
      .finally(() => setLoadingQueue(false))
  }

  const loadDetail = (id: string) => {
    setLoadingDetail(true)
    setError(null)
    api(`/admin/packing/orders/${id}`)
      .then((body) => setDetail(body))
      .catch((e) => setError(e?.message || "Failed to load order"))
      .finally(() => setLoadingDetail(false))
  }

  useEffect(() => {
    loadQueue()
  }, [])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
    else setDetail(null)
  }, [selectedId])

  const refresh = () => {
    if (selectedId) loadDetail(selectedId)
    loadQueue()
  }

  const run = async (key: string, fn: () => Promise<any>) => {
    setBusy(key)
    setError(null)
    try {
      return await fn()
    } catch (e: any) {
      setError(e?.message || "Request failed")
      return null
    } finally {
      setBusy(null)
    }
  }

  const startPacking = async () => {
    const confirmed = await prompt({
      title: "Start packing this order?",
      description:
        "This fulfills the order and hands it to Shiprocket, which will try to auto-assign an AWB and label right away. Only confirm once you're ready to actually pack the box.",
      confirmText: "Start Packing",
      cancelText: "Cancel",
    })
    if (!confirmed) return

    run("start", async () => {
      await api(`/admin/packing/orders/${selectedId}/start`, { method: "POST" })
      refresh()
    })
  }

  const togglePacked = (item: Item, allButThisPacked: boolean) =>
    run(`item:${item.id}`, async () => {
      const needsWrapperCount =
        !item.packed &&
        allButThisPacked &&
        detail?.gift_wrap &&
        detail.gift_wrappers_used == null
      await api(`/admin/packing/orders/${selectedId}/items/${item.id}`, {
        method: "POST",
        body: JSON.stringify({
          packed: !item.packed,
          ...(needsWrapperCount ? { gift_wrappers_used: Number(wrapperCount) } : {}),
        }),
      })
      refresh()
    })

  const assignAwb = () =>
    run("awb", async () => {
      await api(
        `/admin/orders/${selectedId}/fulfillments/${detail?.fulfillment?.id}/shiprocket`,
        { method: "POST", body: JSON.stringify({ action: "assign_awb" }) }
      )
      refresh()
    })

  const generateLabel = () =>
    run("label", async () => {
      const body = await api(
        `/admin/orders/${selectedId}/fulfillments/${detail?.fulfillment?.id}/shiprocket`,
        { method: "POST", body: JSON.stringify({ action: "generate_label" }) }
      )
      if (body?.label_url) window.open(body.label_url, "_blank", "noopener,noreferrer")
      refresh()
    })

  const readyToShip = () =>
    run("ready", async () => {
      await api(`/admin/packing/orders/${selectedId}/ready-to-ship`, { method: "POST" })
      refresh()
    })

  const requestPickup = () =>
    run("pickup", async () => {
      await api(
        `/admin/orders/${selectedId}/fulfillments/${detail?.fulfillment?.id}/shiprocket`,
        { method: "POST", body: JSON.stringify({ action: "request_pickup" }) }
      )
      refresh()
    })

  const markShipped = () =>
    run("shipped", async () => {
      await api(`/admin/packing/orders/${selectedId}/mark-shipped`, { method: "POST" })
      refresh()
    })

  const resetShipment = async () => {
    const confirmed = await prompt({
      title: "Reset this shipment?",
      description:
        "Voids the AWB/courier assignment at Shiprocket and clears the AWB, label, and ready-to-ship state on this order so packing can be redone properly. The order itself is NOT cancelled and nothing is refunded. Only do this if it hasn't actually been picked up by the courier yet.",
      confirmText: "Reset Shipment",
      cancelText: "Cancel",
    })
    if (!confirmed) return

    run("reset", async () => {
      await api(
        `/admin/orders/${selectedId}/fulfillments/${detail?.fulfillment?.id}/shiprocket`,
        { method: "POST", body: JSON.stringify({ action: "reset_shipment" }) }
      )
      refresh()
    })
  }

  const allPacked = !!detail && detail.items.length > 0 && detail.items.every((i) => i.packed)
  const awbDone = !!detail?.fulfillment?.awb_code
  const labelDone = !!detail?.fulfillment?.label_url
  const pickupDone = !!detail?.fulfillment?.pickup_requested_at
  const shipped = !!detail?.fulfillment?.shipped_at

  return (
    <Container>
      <div style={{ display: "flex", gap: "16px" }}>
        <Heading level="h1">Packing</Heading>
      </div>
      <Text size="small" style={{ color: "#666", marginTop: 4 }}>
        Orders waiting to be packed and dispatched, oldest first.
      </Text>

      {simulate && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 12px",
            borderRadius: 6,
            background: "#FEF3C7",
            border: "1px solid #F5D48A",
          }}
        >
          <Text size="small" weight="plus" style={{ color: "#92400E" }}>
            TEST MODE — no real courier is being contacted. Every AWB, label, and pickup you see
            here is simulated; nothing was sent to Shiprocket.
          </Text>
        </div>
      )}

      {error && (
        <Text size="small" style={{ color: "#b91c1c", marginTop: 12 }}>
          {error}
        </Text>
      )}

      <div style={{ marginTop: 16 }}>
        {loadingQueue ? (
          <Text size="small">Loading…</Text>
        ) : queue.length === 0 ? (
          <Text size="small" style={{ color: "#666" }}>
            Nothing waiting — every order is packed and shipped.
          </Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Order</Table.HeaderCell>
                <Table.HeaderCell>Email</Table.HeaderCell>
                <Table.HeaderCell>Items</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Progress</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {queue.map((o) => (
                <Table.Row
                  key={o.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedId(o.id)}
                >
                  <Table.Cell>#{o.display_id}</Table.Cell>
                  <Table.Cell>{o.email}</Table.Cell>
                  <Table.Cell>{o.item_count}</Table.Cell>
                  <Table.Cell>{o.fulfillment_status}</Table.Cell>
                  <Table.Cell>
                    {o.ready_to_ship ? (
                      <Badge color="green">Ready to ship</Badge>
                    ) : o.started ? (
                      <Badge color="orange">Packing</Badge>
                    ) : (
                      <Badge color="grey">Not started</Badge>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>

      <Drawer open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>
              {detail ? `Order #${detail.display_id}` : "Order"}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {loadingDetail && <Text size="small">Loading…</Text>}

            {detail && (
              <>
                <a
                  href={`/admin/orders/${detail.id}/pick-label`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: "#5D2E46", fontWeight: 600 }}
                >
                  Open pick-pack sheet →
                </a>

                {/* Step 1: Start packing */}
                {detail.packing ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Checkbox checked disabled />
                    <Text size="small" weight="plus">
                      Start packing
                    </Text>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      textAlign: "center",
                    }}
                  >
                    <Button size="small" disabled={busy === "start"} onClick={startPacking}>
                      {busy === "start" ? "Starting…" : "Start Packing"}
                    </Button>
                    <Text size="small" style={{ color: "#666" }}>
                      This fulfills the order and hands it to Shiprocket, which will try to
                      auto-assign an AWB and label right away — do this only once you're ready
                      to actually pack the box.
                    </Text>
                  </div>
                )}

                {/* Step 2: Per-item packed checkboxes */}
                {detail.packing && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {detail.items.map((item) => {
                      const allButThisPacked = detail.items
                        .filter((i) => i.id !== item.id)
                        .every((i) => i.packed)
                      return (
                        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Checkbox
                            checked={item.packed}
                            disabled={busy === `item:${item.id}`}
                            onCheckedChange={() => togglePacked(item, allButThisPacked)}
                          />
                          <Text size="small">
                            Packed {item.title}
                            {item.variant_title ? ` — ${item.variant_title}` : ""} × {item.quantity}
                          </Text>
                        </div>
                      )
                    })}

                    {detail.gift_wrap && detail.gift_wrappers_used == null && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Label htmlFor="wrapper-count" style={{ fontSize: 12 }}>
                          Gift wrappers to use
                        </Label>
                        <Input
                          id="wrapper-count"
                          type="number"
                          min={0}
                          max={100}
                          value={wrapperCount}
                          onChange={(e) => setWrapperCount(e.target.value)}
                          style={{ width: 72 }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3-4: AWB + label */}
                {detail.packing && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {awbDone ? (
                        <>
                          <Checkbox checked disabled />
                          <Text size="small" weight="plus">
                            AWB generated
                            {detail.fulfillment?.awb_code ? ` — ${detail.fulfillment.awb_code}` : ""}
                          </Text>
                        </>
                      ) : (
                        <Button
                          size="small"
                          disabled={!allPacked || busy === "awb"}
                          onClick={assignAwb}
                        >
                          {busy === "awb" ? "Assigning…" : "Assign AWB"}
                        </Button>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {labelDone ? (
                        <>
                          <Checkbox checked disabled />
                          <Text size="small" weight="plus">
                            Label printed
                          </Text>
                          <a
                            href={detail.fulfillment?.label_url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 12, color: "#5D2E46", fontWeight: 600 }}
                          >
                            Reprint →
                          </a>
                        </>
                      ) : (
                        <Button
                          size="small"
                          disabled={!awbDone || busy === "label"}
                          onClick={generateLabel}
                        >
                          {busy === "label" ? "Generating…" : "Print label"}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 5: Ready to ship */}
                {detail.packing && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {detail.packing.ready_to_ship_at ? (
                        <>
                          <Checkbox checked disabled />
                          <Text size="small" weight="plus">
                            Ready to ship
                          </Text>
                        </>
                      ) : (
                        <Button
                          size="small"
                          disabled={!labelDone || busy === "ready"}
                          onClick={readyToShip}
                        >
                          {busy === "ready" ? "Marking…" : "Mark as Ready to Ship"}
                        </Button>
                      )}
                    </div>

                    {/* Marking ready-to-ship auto-requests pickup; surface it separately
                        since the request itself can fail even though ready-to-ship succeeded. */}
                    {detail.packing.ready_to_ship_at && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 26 }}>
                        {pickupDone ? (
                          <>
                            <Checkbox checked disabled />
                            <Text size="small" weight="plus">
                              Pickup requested
                              {detail.fulfillment?.pickup_scheduled_date
                                ? ` — courier due ${detail.fulfillment.pickup_scheduled_date}`
                                : ""}
                            </Text>
                            <Button
                              size="small"
                              variant="transparent"
                              disabled={busy === "pickup"}
                              onClick={requestPickup}
                            >
                              {busy === "pickup" ? "Requesting…" : "Request again"}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Text size="small" style={{ color: "#b91c1c" }}>
                              Shiprocket didn't confirm the pickup request.
                            </Text>
                            <Button
                              size="small"
                              variant="secondary"
                              disabled={busy === "pickup"}
                              onClick={requestPickup}
                            >
                              {busy === "pickup" ? "Requesting…" : "Request Pickup"}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 6: Shipped */}
                {detail.packing?.ready_to_ship_at && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {shipped ? (
                      <>
                        <Checkbox checked disabled />
                        <Text size="small" weight="plus">
                          Shipped
                        </Text>
                      </>
                    ) : (
                      <Button size="small" disabled={busy === "shipped"} onClick={markShipped}>
                        {busy === "shipped" ? "Marking…" : "Mark as Shipped"}
                      </Button>
                    )}
                  </div>
                )}

                {/* Escape hatch: undo a mistaken AWB/ready-to-ship mark, without
                    cancelling the order or touching payment. Only relevant once
                    something's actually been done, and only before it's shipped. */}
                {detail.packing && (awbDone || detail.packing.ready_to_ship_at) && !shipped && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    <Button
                      size="small"
                      variant="danger"
                      disabled={busy === "reset"}
                      onClick={resetShipment}
                    >
                      {busy === "reset" ? "Resetting…" : "Reset Shipment"}
                    </Button>
                    <Text size="small" style={{ color: "#666" }}>
                      Made a mistake — AWB generated or marked ready to ship too soon? This voids
                      it at Shiprocket and lets you redo AWB/label/ready-to-ship for this order.
                    </Text>
                  </div>
                )}

                {/* Activity log — who did what, and when. Kept even after a
                    cancelled attempt resets the checklist above, so the record
                    of what happened isn't lost. */}
                {!!detail.history?.length && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      marginTop: 8,
                      paddingTop: 12,
                      borderTop: "1px solid #e5e5e5",
                    }}
                  >
                    <Text size="small" weight="plus" style={{ color: "#666" }}>
                      Activity log
                    </Text>
                    {detail.history.map((h, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <Text size="small">
                          {historyStepLabel(h.step)} — {h.actor_email || "Unknown user"}
                        </Text>
                        <Text size="small" style={{ color: "#999", whiteSpace: "nowrap" }}>
                          {formatWhen(h.at)}
                        </Text>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Packing",
  icon: TruckFast,
})

export default PackingPage
