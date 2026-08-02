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
  /** Null for service lines (gift wrap, COD fee) — those get no product link. */
  product_url: string | null
  product_handle: string | null
  quantity: number
  packed: boolean
}

type HistoryEntry = {
  step: string
  at: string
  actor_id: string | null
  actor_email: string | null
  /** Extras some steps record alongside themselves (see logStep). */
  awb_code?: string | null
  attempt?: number | null
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
    invoice_printed_at: string | null
    invoice_added_at: string | null
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
  invoice_printed: "Printed the invoice",
  invoice_added: "Added the invoice to the box",
  invoice_unadded: "Unmarked the invoice as added to the box",
  pickup_requested: "Requested courier pickup",
  pickup_request_failed: "Tried to request pickup — Shiprocket didn't confirm",
  shipped: "Marked shipped",
  shiprocket_order_created: "Re-created the Shiprocket order",
  awb_changed: "Courier reassigned by Shiprocket — AWB changed, label needs reprinting",
  restarted_after_cancel: "Restarted packing after the previous attempt was cancelled",
  shipment_reset: "Reset the shipment (undid AWB / ready-to-ship)",
}

/**
 * Lines that aren't physically picked. The server already excludes these when
 * deciding whether every item is packed, so showing them here only invited
 * ticking a box for a fee.
 */
const SERVICE_HANDLES = ["gift-wrap", "cod-fee"]

const isMerchandise = (item: { product_handle: string | null }) =>
  !SERVICE_HANDLES.includes(item.product_handle || "")

/**
 * Turns a raw history step into something a packer can read.
 *
 * `item_packed:<id>` carries the line it refers to, so name it — "Marked an
 * item packed" three times in a row says nothing about which items. Extras
 * recorded alongside the step (AWB code, wrapper count) are surfaced too.
 */
function historyStepLabel(
  entry: HistoryEntry,
  itemTitles: Record<string, string>
): string {
  const { step } = entry

  if (step.startsWith("item_packed:") || step.startsWith("item_unpacked:")) {
    const title = itemTitles[step.split(":")[1]]
    const verb = step.startsWith("item_packed:") ? "Packed" : "Unpacked"
    return title ? `${verb} ${title}` : STEP_LABELS[
      step.startsWith("item_packed:") ? "item_packed" : "item_unpacked"
    ]
  }

  const base = STEP_LABELS[step] || step
  if (step === "awb_assigned" && entry.awb_code) {
    return `${base} — ${entry.awb_code}`
  }
  if (step === "shiprocket_order_created" && entry.attempt) {
    return `${base} (attempt ${entry.attempt})`
  }
  return base
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

  const printInvoice = () =>
    run("invoice_print", async () => {
      window.open(`/admin/orders/${selectedId}/invoice`, "_blank", "noopener,noreferrer")
      await api(`/admin/packing/orders/${selectedId}/invoice`, {
        method: "POST",
        body: JSON.stringify({ action: "mark_printed" }),
      })
      refresh()
    })

  const toggleInvoiceAdded = (added: boolean) =>
    run("invoice_added", async () => {
      await api(`/admin/packing/orders/${selectedId}/invoice`, {
        method: "POST",
        body: JSON.stringify({ action: "toggle_added", added }),
      })
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
        "Voids the AWB and courier assignment at Shiprocket and clears the label and ready-to-ship state, so AWB/label/ready-to-ship can be redone for this order. The order itself is NOT cancelled and no payment is touched. Shiprocket charges at assignment, so the AWB you are voiding has already been paid for and is not automatically refunded. Only do this if the courier has not actually picked the parcel up yet.",
      confirmText: "Reset shipment",
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

  // Merchandise only — matches the server, which leaves service lines out of
  // the "every item packed" check.
  const merchandise = (detail?.items || []).filter(isMerchandise)
  const allPacked = merchandise.length > 0 && merchandise.every((i) => i.packed)

  /** Line id → title, so the activity log can name the item a step refers to. */
  const itemTitles: Record<string, string> = Object.fromEntries(
    (detail?.items || []).map((i) => [i.id, i.title])
  )

  /**
   * Service lines are hidden from the checklist, so their tick/untick entries
   * have no place in the log either — "Packed COD Handling Fee" describes
   * something nobody picked up.
   */
  const serviceItemIds = new Set(
    (detail?.items || []).filter((i) => !isMerchandise(i)).map((i) => i.id)
  )

  /** Items currently ticked — a "Packed X" line only stands while X is packed. */
  const packedItemIds = new Set(
    (detail?.items || []).filter((i) => i.packed).map((i) => i.id)
  )

  const visibleHistory = (detail?.history || []).filter((h) => {
    // Legacy rows: unpacking removes the line now, but orders packed before
    // that change still carry "Unmarked an item as packed" pairs.
    if (h.step.startsWith("item_unpacked:")) return false

    const match = /^item_packed:(.+)$/.exec(h.step)
    if (!match) return true
    const itemId = match[1]
    return !serviceItemIds.has(itemId) && packedItemIds.has(itemId)
  })
  const awbDone = !!detail?.fulfillment?.awb_code
  const labelDone = !!detail?.fulfillment?.label_url
  const invoicePrinted = !!detail?.packing?.invoice_printed_at

  /**
   * Everything that must be true before a van can be called. "Invoice added to
   * box" is deliberately NOT in here — it's a useful record but not a gate.
   * The same list is enforced server-side (see PACKING_STEPS); this only stops
   * the click that would be rejected anyway.
   */
  const readyBlockers = [
    !detail?.packing && "Start packing",
    !allPacked && "Pack every item",
    !awbDone && "Generate the AWB",
    !labelDone && "Print the label",
    !invoicePrinted && "Print the invoice",
  ].filter(Boolean) as string[]
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
          data-testid="packing-simulate-banner"
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
                  data-testid="packing-queue-row"
                  data-display-id={o.display_id}
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
        {/*
          Wider than the stock 560px. The checklist carries full product titles
          plus variant and quantity on one line, and the activity log puts a
          sentence and a timestamp side by side — at 560px both wrapped
          constantly. Inline style because the built-in `sm:max-w-[560px]` would
          otherwise win on class order.
        */}
        <Drawer.Content style={{ maxWidth: "min(95vw, 1120px)" }}>
          <Drawer.Header>
            <Drawer.Title data-testid="packing-drawer-title" data-display-id={detail?.display_id}>
              {detail ? `Order #${detail.display_id}` : "Order"}
            </Drawer.Title>
          </Drawer.Header>
          {/*
            Drawer.Body ships as `flex-1 px-6 py-4` — no overflow rule, and no
            min-height:0. A flex child won't shrink past its content without
            that, so a long checklist + activity log overflowed the fixed-height
            drawer and was simply cut off at the bottom with nothing to scroll.
          */}
          <Drawer.Body
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
            }}
          >
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
                    <Button
                      size="small"
                      data-testid="packing-start-button"
                      disabled={busy === "start"}
                      onClick={startPacking}
                    >
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
                    {detail.items.filter(isMerchandise).map((item) => {
                      const allButThisPacked = detail.items
                        .filter(isMerchandise)
                        .filter((i) => i.id !== item.id)
                        .every((i) => i.packed)
                      return (
                        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Checkbox
                            data-testid="packing-item-checkbox"
                            checked={item.packed}
                            disabled={busy === `item:${item.id}`}
                            onCheckedChange={() => togglePacked(item, allButThisPacked)}
                          />
                          <Text size="small">
                            Packed{" "}
                            {/* Opens the product in a new tab: checking a piece
                                against its photo/SKU shouldn't cost the packer
                                their place in the checklist. */}
                            {item.product_url ? (
                              <a
                                href={item.product_url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ textDecoration: "underline" }}
                              >
                                {item.title}
                              </a>
                            ) : (
                              item.title
                            )}
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
                          data-testid="packing-assign-awb-button"
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
                          data-testid="packing-print-label-button"
                          disabled={!awbDone || busy === "label"}
                          onClick={generateLabel}
                        >
                          {busy === "label" ? "Generating…" : "Print label"}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 4.5: Invoice — print it, then confirm it physically went in the box */}
                {detail.packing && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* Reads exactly like the "Label printed — Reprint →" row
                        above once done: a done step is a ticked line, not a
                        button that still looks like the next thing to press. */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {detail.packing.invoice_printed_at ? (
                        <>
                          <Checkbox checked disabled />
                          <Text size="small" weight="plus">
                            Invoice printed
                          </Text>
                          <button
                            type="button"
                            data-testid="packing-print-invoice-button"
                            disabled={busy === "invoice_print"}
                            onClick={printInvoice}
                            style={{
                              fontSize: 12,
                              color: "#5D2E46",
                              fontWeight: 600,
                              background: "none",
                              border: 0,
                              padding: 0,
                              cursor: busy === "invoice_print" ? "default" : "pointer",
                            }}
                          >
                            {busy === "invoice_print" ? "Printing…" : "Reprint →"}
                          </button>
                        </>
                      ) : (
                        <Button
                          size="small"
                          data-testid="packing-print-invoice-button"
                          disabled={busy === "invoice_print"}
                          onClick={printInvoice}
                        >
                          {busy === "invoice_print" ? "Printing…" : "Print Invoice"}
                        </Button>
                      )}
                    </div>

                    {detail.packing.invoice_printed_at && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Checkbox
                          data-testid="packing-invoice-added-checkbox"
                          checked={!!detail.packing.invoice_added_at}
                          disabled={busy === "invoice_added"}
                          onCheckedChange={(checked) => toggleInvoiceAdded(!!checked)}
                        />
                        <Text size="small">Invoice added to box</Text>
                      </div>
                    )}
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
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <Button
                            size="small"
                            data-testid="packing-ready-to-ship-button"
                            disabled={readyBlockers.length > 0 || busy === "ready"}
                            onClick={readyToShip}
                          >
                            {busy === "ready" ? "Marking…" : "Mark as Ready to Ship"}
                          </Button>
                          {readyBlockers.length > 0 && (
                            // Says why, rather than leaving a dead button.
                            <Text size="small" style={{ color: "#999" }}>
                              First: {readyBlockers.join(", ")}
                            </Text>
                          )}
                        </div>
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
                      <Button
                        size="small"
                        data-testid="packing-mark-shipped-button"
                        disabled={busy === "shipped"}
                        onClick={markShipped}
                      >
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
                      justifyContent: "flex-end",
                      marginTop: 4,
                    }}
                  >
                    {/* Understated on purpose, and matching the order page's
                        Dispatch card. The explanation that used to sit under
                        this button now lives in the confirm dialog, where it
                        is read at the moment it matters instead of becoming
                        wallpaper next to every packed order. */}
                    <Button
                      size="small"
                      variant="transparent"
                      disabled={busy === "reset"}
                      onClick={resetShipment}
                    >
                      {busy === "reset" ? "Resetting…" : "Reset shipment"}
                    </Button>
                  </div>
                )}

                {/* Activity log — who did what, and when. Kept even after a
                    cancelled attempt resets the checklist above, so the record
                    of what happened isn't lost. */}
                {!!visibleHistory.length && (
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
                    {/* No scrollbar of its own — the drawer body scrolls, and a
                        second scroll area nested inside it is a trap on a
                        narrow panel. */}
                    <div
                      style={{ display: "flex", flexDirection: "column", gap: 6 }}
                    >
                      {visibleHistory.map((h, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                          <Text size="small">{historyStepLabel(h, itemTitles)}</Text>
                          {/* Who and when travel together on the right, in the
                              same muted weight — the event is what you scan
                              for, the attribution is what you check after. */}
                          <Text
                            size="small"
                            style={{
                              color: "#999",
                              whiteSpace: "nowrap",
                              display: "flex",
                              gap: 6,
                            }}
                          >
                            <span>({h.actor_email || "unknown user"})</span>
                            <span>{formatWhen(h.at)}</span>
                          </Text>
                        </div>
                      ))}
                    </div>
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
