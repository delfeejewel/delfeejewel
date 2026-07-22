import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProduct } from "@medusajs/types"
import { Button, Container, Heading, Input, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

/**
 * "Stock" card — a plain number per variant.
 *
 * The store runs a single stock location, so Medusa's native
 * variant → inventory item → location-level drill-down is friction with no
 * payoff. This shows one number per variant and saves it straight to that
 * location via /admin/simple-stock.
 *
 * Shown to the `admin` role only; developers keep the full native inventory UI
 * (they occasionally need the underlying items/levels for debugging).
 */

type DetailWidgetProps = { data: AdminProduct }

type Row = {
  variant_id: string
  title: string
  sku: string | null
  quantity: number
  reserved?: number
  available?: number
  manage_inventory?: boolean
}

const ProductSimpleStock = ({ data }: DetailWidgetProps) => {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [locationName, setLocationName] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  // Role gate: admins get the simple card, developers keep the native UI.
  useEffect(() => {
    let cancelled = false
    fetch("/admin/users/me", { credentials: "include" })
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return
        const role = body?.user?.metadata?.role ?? "admin"
        setAllowed(role !== "developer")
      })
      .catch(() => !cancelled && setAllowed(false))
    return () => {
      cancelled = true
    }
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/admin/simple-stock?product_id=${data.id}`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Could not load stock")
      const body = await res.json()
      setRows(body.variants || [])
      setLocationName(body.location?.name || "")
      setValues(
        Object.fromEntries(
          (body.variants || []).map((v: Row) => [v.variant_id, String(v.quantity)])
        )
      )
    } catch {
      toast.error("Could not load stock")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (allowed) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, data.id])

  const save = async (variantId: string) => {
    const raw = values[variantId]
    const qty = Number(raw)
    if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
      toast.error("Enter a whole number, 0 or more")
      return
    }
    setSavingId(variantId)
    try {
      const res = await fetch("/admin/simple-stock", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant_id: variantId, quantity: qty }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || "Failed to save")
      }
      setRows((prev) =>
        prev.map((r) => (r.variant_id === variantId ? { ...r, quantity: qty } : r))
      )
      toast.success("Stock updated")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSavingId(null)
    }
  }

  if (allowed === null || allowed === false) return null

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Stock</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {locationName
              ? `Units available at ${locationName}.`
              : "Units available."}{" "}
            Enter a number and press Save.
          </Text>
        </div>
        <Button size="small" variant="secondary" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="px-6 py-4">
        {loading ? (
          <Text size="small" className="text-ui-fg-subtle">
            Loading…
          </Text>
        ) : rows.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            No variants on this product yet.
          </Text>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((r) => {
              const dirty = String(r.quantity) !== (values[r.variant_id] ?? "")
              return (
                <div
                  key={r.variant_id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-ui-border-base px-3 py-2"
                >
                  <div className="min-w-0">
                    <Text size="small" weight="plus" className="truncate">
                      {r.title || "Default"}
                    </Text>
                    {r.sku && (
                      <Text size="xsmall" className="text-ui-fg-muted truncate">
                        {r.sku}
                      </Text>
                    )}
                    {/* Only surfaced when it matters: an order reserves units
                        immediately but stock is only decremented on fulfilment,
                        so without this the number looks unchanged after a sale. */}
                    {!!r.reserved && r.reserved > 0 && (
                      <Text size="xsmall" className="text-ui-fg-interactive">
                        {r.reserved} reserved for unfulfilled orders ·{" "}
                        {r.available} sellable
                      </Text>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      className="w-24"
                      value={values[r.variant_id] ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [r.variant_id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && dirty) save(r.variant_id)
                      }}
                    />
                    <Button
                      size="small"
                      onClick={() => save(r.variant_id)}
                      isLoading={savingId === r.variant_id}
                      disabled={!dirty}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductSimpleStock
