import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Gift } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Switch,
  Table,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

type GiftCard = {
  id: string
  code: string
  value: number
  balance: number
  currency_code: string
  status: "active" | "redeemed" | "expired" | "void"
  expires_at: string | null
  recipient_email: string
  recipient_name: string | null
  purchaser_order_id: string | null
  created_at: string
}

const STATUS_COLORS: Record<GiftCard["status"], "green" | "grey" | "orange" | "red"> = {
  active: "green",
  redeemed: "grey",
  expired: "orange",
  void: "red",
}

const fmt = (amount: number, cc: string) => {
  const sym = cc?.toLowerCase() === "inr" ? "₹" : ""
  return `${sym}${Number(amount || 0).toLocaleString("en-IN")}`
}

const PAGE_SIZE = 50

const emptyForm = {
  value: "",
  currency_code: "inr",
  recipient_email: "",
  recipient_name: "",
  message: "",
  send_email: true,
}

const GiftCardsPage = () => {
  const [rows, setRows] = useState<GiftCard[]>([])
  const [count, setCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [issuing, setIssuing] = useState(false)

  const load = (opts?: { offset?: number; q?: string; status?: string }) => {
    const o = opts?.offset ?? offset
    const query = opts?.q ?? q
    const st = opts?.status ?? status
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      offset: String(o),
      limit: String(PAGE_SIZE),
      status: st,
    })
    if (query.trim()) params.set("q", query.trim())
    fetch(`/admin/gift-cards?${params.toString()}`, { credentials: "include" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
        setRows(body.gift_cards || [])
        setCount(body.count || 0)
      })
      .catch((e) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load({ offset: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyFilters = () => {
    setOffset(0)
    load({ offset: 0 })
  }

  const action = async (id: string, payload: Record<string, any>, ok: string) => {
    setBusy(id)
    try {
      const r = await fetch(`/admin/gift-cards/${id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
      toast.success(ok)
      load()
    } catch (e: any) {
      toast.error(e?.message || "Action failed")
    } finally {
      setBusy(null)
    }
  }

  const voidCard = (gc: GiftCard) => {
    if (!window.confirm(`Void gift card ${gc.code}? Its remaining balance becomes unusable.`)) return
    action(gc.id, { action: "void" }, "Gift card voided.")
  }

  const reactivate = (gc: GiftCard) =>
    action(gc.id, { action: "reactivate" }, "Gift card reactivated.")

  const adjustBalance = (gc: GiftCard) => {
    const input = window.prompt(
      `Set new balance for ${gc.code} (${gc.currency_code.toUpperCase()}). Current: ${gc.balance}`,
      String(gc.balance)
    )
    if (input === null) return
    const next = Number(input)
    if (!Number.isFinite(next) || next < 0) {
      toast.error("Enter a number >= 0.")
      return
    }
    action(gc.id, { action: "set_balance", balance: next }, "Balance updated.")
  }

  const issue = async () => {
    const value = Number(form.value)
    if (!value || value <= 0) return toast.error("Enter a positive value.")
    if (!form.recipient_email.trim()) return toast.error("Recipient email is required.")
    setIssuing(true)
    try {
      const r = await fetch(`/admin/gift-cards`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, value }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
      if (body.email_error) {
        toast.warning(`Issued ${body.gift_card.code}, but email failed: ${body.email_error}`)
      } else {
        toast.success(`Issued gift card ${body.gift_card.code}.`)
      }
      setForm({ ...emptyForm })
      setDrawerOpen(false)
      setOffset(0)
      load({ offset: 0 })
    } catch (e: any) {
      toast.error(e?.message || "Could not issue gift card.")
    } finally {
      setIssuing(false)
    }
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE))

  const goto = (next: number) => {
    setOffset(next)
    load({ offset: next })
  }

  return (
    <Container>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <Heading level="h1">Gift Cards</Heading>
            <Text size="small" style={{ color: "var(--fg-subtle)", marginTop: 4 }}>
              Issued automatically when a customer buys a Gift Card. Issue one
              manually, adjust balances, or void a card here.
            </Text>
          </div>
          <Button size="small" onClick={() => setDrawerOpen(true)}>
            Issue gift card
          </Button>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Input
            placeholder="Search code or recipient email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            style={{ maxWidth: 320 }}
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setOffset(0)
              load({ offset: 0, status: e.target.value })
            }}
            style={{
              height: 32,
              borderRadius: 6,
              border: "1px solid var(--border-base)",
              background: "var(--bg-field)",
              padding: "0 8px",
              fontSize: 13,
            }}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="redeemed">Redeemed</option>
            <option value="expired">Expired</option>
            <option value="void">Void</option>
          </select>
          <Button variant="secondary" size="small" onClick={applyFilters} disabled={loading}>
            Search
          </Button>
        </div>

        {loading && <Text size="small">Loading…</Text>}
        {error && (
          <Text size="small" style={{ color: "#b91c1c" }}>
            {error}
          </Text>
        )}

        {!loading && !error && rows.length === 0 && (
          <Text size="small" style={{ color: "var(--fg-subtle)" }}>
            No gift cards found.
          </Text>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Code</Table.HeaderCell>
                  <Table.HeaderCell>Recipient</Table.HeaderCell>
                  <Table.HeaderCell>Value</Table.HeaderCell>
                  <Table.HeaderCell>Balance</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Expires</Table.HeaderCell>
                  <Table.HeaderCell> </Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((gc) => (
                  <Table.Row key={gc.id}>
                    <Table.Cell>
                      <span style={{ fontFamily: "monospace", fontSize: 12.5 }}>{gc.code}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span>{gc.recipient_email}</span>
                        {gc.recipient_name && (
                          <span style={{ color: "var(--fg-subtle)", fontSize: 12 }}>
                            {gc.recipient_name}
                          </span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>{fmt(gc.value, gc.currency_code)}</Table.Cell>
                    <Table.Cell>{fmt(gc.balance, gc.currency_code)}</Table.Cell>
                    <Table.Cell>
                      <Badge color={STATUS_COLORS[gc.status]} size="2xsmall">
                        {gc.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {gc.expires_at
                        ? new Date(gc.expires_at).toLocaleDateString("en-IN")
                        : "—"}
                    </Table.Cell>
                    <Table.Cell>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => adjustBalance(gc)}
                          disabled={busy === gc.id || gc.status === "void"}
                        >
                          Adjust
                        </Button>
                        {gc.status === "void" ? (
                          <Button
                            size="small"
                            variant="secondary"
                            onClick={() => reactivate(gc)}
                            disabled={busy === gc.id}
                          >
                            Reactivate
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="danger"
                            onClick={() => voidCard(gc)}
                            disabled={busy === gc.id}
                          >
                            Void
                          </Button>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Text size="small" style={{ color: "var(--fg-subtle)" }}>
                {count} card{count === 1 ? "" : "s"} · page {page} of {pageCount}
              </Text>
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => goto(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0 || loading}
                >
                  Previous
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => goto(offset + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= count || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Issue drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Issue a gift card</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <Label size="small" weight="plus">Value *</Label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 1000"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              />
            </div>
            <div>
              <Label size="small" weight="plus">Currency</Label>
              <Input
                placeholder="inr"
                value={form.currency_code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currency_code: e.target.value.toLowerCase() }))
                }
              />
            </div>
            <div>
              <Label size="small" weight="plus">Recipient email *</Label>
              <Input
                type="email"
                placeholder="them@example.com"
                value={form.recipient_email}
                onChange={(e) => setForm((f) => ({ ...f, recipient_email: e.target.value }))}
              />
            </div>
            <div>
              <Label size="small" weight="plus">Recipient name</Label>
              <Input
                placeholder="Optional"
                value={form.recipient_name}
                onChange={(e) => setForm((f) => ({ ...f, recipient_name: e.target.value }))}
              />
            </div>
            <div>
              <Label size="small" weight="plus">Message</Label>
              <Textarea
                placeholder="Optional note included in the email"
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Switch
                checked={form.send_email}
                onCheckedChange={(v) => setForm((f) => ({ ...f, send_email: v }))}
              />
              <Label size="small">Email the code to the recipient now</Label>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Drawer.Close>
            <Button onClick={issue} disabled={issuing}>
              {issuing ? "Issuing…" : "Issue gift card"}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Gift Cards",
  icon: Gift,
})

export default GiftCardsPage
