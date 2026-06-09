import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Tag } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

type Coupon = {
  id: string
  code: string
  status: "active" | "inactive" | "draft"
  kind: "percentage" | "fixed"
  value: number
  target: string
  currency_code: string | null
  usage_limit: number | null
  used: number | null
  ends_at: string | null
}

const fmtDiscount = (c: Coupon) => {
  const amount =
    c.kind === "percentage"
      ? `${c.value}% off`
      : `${c.currency_code?.toLowerCase() === "inr" ? "₹" : ""}${Number(
          c.value
        ).toLocaleString("en-IN")} off`
  const where = c.target === "shipping_methods" ? "shipping" : "order"
  return `${amount} ${where}`
}

const PAGE_SIZE = 50

const emptyForm = {
  code: "",
  kind: "percentage",
  value: "",
  target: "order",
  currency_code: "inr",
  usage_limit: "",
  ends_at: "",
}

const CouponsPage = () => {
  const [rows, setRows] = useState<Coupon[]>([])
  const [count, setCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [creating, setCreating] = useState(false)

  const load = (opts?: { offset?: number; q?: string }) => {
    const o = opts?.offset ?? offset
    const query = opts?.q ?? q
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      offset: String(o),
      limit: String(PAGE_SIZE),
    })
    if (query.trim()) params.set("q", query.trim())
    fetch(`/admin/coupons?${params.toString()}`, { credentials: "include" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
        setRows(body.coupons || [])
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

  const remove = async (c: Coupon) => {
    if (!window.confirm(`Delete coupon ${c.code}? This can't be undone.`)) return
    setBusy(c.id)
    try {
      const r = await fetch(`/admin/coupons/${c.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
      toast.success(`Deleted ${c.code}.`)
      load()
    } catch (e: any) {
      toast.error(e?.message || "Delete failed")
    } finally {
      setBusy(null)
    }
  }

  const toggle = async (c: Coupon) => {
    const next = c.status === "active" ? "inactive" : "active"
    setBusy(c.id)
    try {
      const r = await fetch(`/admin/coupons/${c.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
      toast.success(next === "active" ? "Coupon enabled." : "Coupon disabled.")
      load()
    } catch (e: any) {
      toast.error(e?.message || "Update failed")
    } finally {
      setBusy(null)
    }
  }

  const create = async () => {
    const value = Number(form.value)
    if (!form.code.trim()) return toast.error("Enter a coupon code.")
    if (!value || value <= 0) return toast.error("Enter a discount value.")
    if (form.kind === "percentage" && value > 100) {
      return toast.error("Percentage can't exceed 100.")
    }
    setCreating(true)
    try {
      const payload: Record<string, any> = {
        code: form.code,
        kind: form.kind,
        value,
        target: form.target,
        currency_code: form.currency_code,
      }
      if (Number(form.usage_limit) > 0) payload.usage_limit = Number(form.usage_limit)
      if (form.ends_at) payload.ends_at = new Date(form.ends_at).toISOString()

      const r = await fetch(`/admin/coupons`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
      toast.success(`Created coupon ${body.coupon.code}.`)
      setForm({ ...emptyForm })
      setDrawerOpen(false)
      setOffset(0)
      load({ offset: 0 })
    } catch (e: any) {
      toast.error(e?.message || "Could not create coupon.")
    } finally {
      setCreating(false)
    }
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const goto = (next: number) => {
    setOffset(next)
    load({ offset: next })
  }

  const selectStyle = {
    height: 32,
    borderRadius: 6,
    border: "1px solid var(--border-base)",
    background: "var(--bg-field)",
    padding: "0 8px",
    fontSize: 13,
    width: "100%",
  }

  return (
    <Container>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <Heading level="h1">Coupons</Heading>
            <Text size="small" style={{ color: "var(--fg-subtle)", marginTop: 4 }}>
              Create and manage discount codes customers enter at checkout.
            </Text>
          </div>
          <Button size="small" onClick={() => setDrawerOpen(true)}>
            Create coupon
          </Button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Input
            placeholder="Search code…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            style={{ maxWidth: 280 }}
          />
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
            No coupons yet. Create one to get started.
          </Text>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Code</Table.HeaderCell>
                  <Table.HeaderCell>Discount</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Uses</Table.HeaderCell>
                  <Table.HeaderCell>Expires</Table.HeaderCell>
                  <Table.HeaderCell> </Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((c) => (
                  <Table.Row key={c.id}>
                    <Table.Cell>
                      <span style={{ fontFamily: "monospace", fontSize: 12.5 }}>{c.code}</span>
                    </Table.Cell>
                    <Table.Cell>{fmtDiscount(c)}</Table.Cell>
                    <Table.Cell>
                      <Badge color={c.status === "active" ? "green" : "grey"} size="2xsmall">
                        {c.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {c.usage_limit
                        ? `${c.used ?? 0} / ${c.usage_limit}`
                        : c.used != null
                        ? `${c.used}`
                        : "—"}
                    </Table.Cell>
                    <Table.Cell>
                      {c.ends_at ? new Date(c.ends_at).toLocaleDateString("en-IN") : "—"}
                    </Table.Cell>
                    <Table.Cell>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => toggle(c)}
                          disabled={busy === c.id}
                        >
                          {c.status === "active" ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          size="small"
                          variant="danger"
                          onClick={() => remove(c)}
                          disabled={busy === c.id}
                        >
                          Delete
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Text size="small" style={{ color: "var(--fg-subtle)" }}>
                {count} coupon{count === 1 ? "" : "s"} · page {page} of {pageCount}
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

      {/* Create drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Create a coupon</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <Label size="small" weight="plus">Code *</Label>
              <Input
                placeholder="e.g. DIWALI20"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                }
              />
            </div>
            <div>
              <Label size="small" weight="plus">Discount type</Label>
              <select
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                style={selectStyle}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed amount (₹)</option>
              </select>
            </div>
            <div>
              <Label size="small" weight="plus">
                {form.kind === "percentage" ? "Percent off *" : "Amount off *"}
              </Label>
              <Input
                type="number"
                min={1}
                placeholder={form.kind === "percentage" ? "e.g. 20" : "e.g. 200"}
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              />
            </div>
            <div>
              <Label size="small" weight="plus">Applies to</Label>
              <select
                value={form.target}
                onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                style={selectStyle}
              >
                <option value="order">Order total</option>
                <option value="shipping">Shipping (free/discounted shipping)</option>
              </select>
            </div>
            <div>
              <Label size="small" weight="plus">Usage limit</Label>
              <Input
                type="number"
                min={1}
                placeholder="Optional — total redemptions"
                value={form.usage_limit}
                onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))}
              />
            </div>
            <div>
              <Label size="small" weight="plus">Expires on</Label>
              <Input
                type="date"
                value={form.ends_at}
                onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
              />
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Drawer.Close>
            <Button onClick={create} disabled={creating}>
              {creating ? "Creating…" : "Create coupon"}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Coupons",
  icon: Tag,
})

export default CouponsPage
