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

type Detail = {
  id: string
  display_id: number
  email: string | null
  fulfillment_status: string
  gift_wrap: boolean
  gift_wrappers_used: number | null
  items: Item[]
  packing: { fulfillment_id: string; started_at: string; ready_to_ship_at: string | null } | null
  fulfillment: {
    id: string
    awb_code: string | null
    courier_name: string | null
    label_url: string | null
    tracking_url: string | null
    shipped_at: string | null
  } | null
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
  const [queue, setQueue] = useState<QueueOrder[]>([])
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [wrapperCount, setWrapperCount] = useState("1")

  const loadQueue = () => {
    setLoadingQueue(true)
    api("/admin/packing/orders")
      .then((body) => setQueue(body.orders || []))
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

  const startPacking = () =>
    run("start", async () => {
      await api(`/admin/packing/orders/${selectedId}/start`, { method: "POST" })
      refresh()
    })

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

  const markShipped = () =>
    run("shipped", async () => {
      await api(`/admin/packing/orders/${selectedId}/mark-shipped`, { method: "POST" })
      refresh()
    })

  const allPacked = !!detail && detail.items.length > 0 && detail.items.every((i) => i.packed)
  const awbDone = !!detail?.fulfillment?.awb_code
  const labelDone = !!detail?.fulfillment?.label_url
  const shipped = !!detail?.fulfillment?.shipped_at

  return (
    <Container>
      <div style={{ display: "flex", gap: "16px" }}>
        <Heading level="h1">Packing</Heading>
      </div>
      <Text size="small" style={{ color: "#666", marginTop: 4 }}>
        Orders waiting to be packed and dispatched, oldest first.
      </Text>

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
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Checkbox checked={!!detail.packing} disabled />
                  <Text size="small" weight="plus">
                    Start packing
                  </Text>
                  {!detail.packing && (
                    <Button size="small" disabled={busy === "start"} onClick={startPacking}>
                      {busy === "start" ? "Starting…" : "Start"}
                    </Button>
                  )}
                </div>

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
                      <Checkbox checked={awbDone} disabled />
                      <Text size="small" weight="plus">
                        AWB generated
                        {detail.fulfillment?.awb_code ? ` — ${detail.fulfillment.awb_code}` : ""}
                      </Text>
                      {!awbDone && (
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
                      <Checkbox checked={labelDone} disabled />
                      <Text size="small" weight="plus">
                        Label printed
                      </Text>
                      {labelDone ? (
                        <a
                          href={detail.fulfillment?.label_url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: "#5D2E46", fontWeight: 600 }}
                        >
                          Reprint →
                        </a>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Checkbox checked={!!detail.packing.ready_to_ship_at} disabled />
                    <Text size="small" weight="plus">
                      Ready to ship
                    </Text>
                    {!detail.packing.ready_to_ship_at && (
                      <Button
                        size="small"
                        disabled={!labelDone || busy === "ready"}
                        onClick={readyToShip}
                      >
                        {busy === "ready" ? "Marking…" : "Mark as Ready to Ship"}
                      </Button>
                    )}
                  </div>
                )}

                {/* Step 6: Shipped */}
                {detail.packing?.ready_to_ship_at && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Checkbox checked={shipped} disabled />
                    <Text size="small" weight="plus">
                      Shipped
                    </Text>
                    {!shipped && (
                      <Button size="small" disabled={busy === "shipped"} onClick={markShipped}>
                        {busy === "shipped" ? "Marking…" : "Mark as Shipped"}
                      </Button>
                    )}
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
