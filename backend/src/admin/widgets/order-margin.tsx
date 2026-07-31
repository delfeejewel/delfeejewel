import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"

/**
 * "Profit breakdown" card on the order page.
 *
 * Shows what the order actually earned: merchandise revenue net of GST, minus
 * product cost, real courier cost and the payment-gateway fee — with shipping
 * margin (charged vs paid) called out separately.
 *
 * Anything not measurable is labelled, never guessed: variants without a cost
 * price are listed by name, and shipping cost only exists once an AWB has been
 * assigned. The header says "Partial" until every input is known, so a figure
 * built on missing data can't be mistaken for the real one.
 */

type Margin = {
  currency_code: string
  complete: boolean
  revenue: {
    merchandise_net: number
    services_net: number
    shipping_charged: number
    discount: number
    tax_collected: number
    order_total: number
  }
  costs: {
    cogs: number
    cogs_known: boolean
    missing_cost_items: string[]
    shipping_actual: number | null
    courier_name: string | null
    gateway_fee: number
    gateway_fee_estimated: boolean
    gateway_fee_basis: {
      percent: number
      gst_on_fee_percent: number
      charged_on: number
      is_cod: boolean
    }
  }
  shipping_margin: number | null
  gross_profit: number
  margin_percent: number | null
  lines: {
    title: string
    quantity: number
    revenue_net: number
    cost: number | null
    profit: number | null
    cost_known: boolean
  }[]
}

const inr = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const Row = ({
  label,
  value,
  hint,
  strong,
  tone,
}: {
  label: string
  value: string
  hint?: string
  strong?: boolean
  tone?: "positive" | "negative" | "muted"
}) => (
  <div className="flex items-start justify-between gap-4 py-1.5">
    <div className="flex flex-col">
      <Text size="small" weight={strong ? "plus" : "regular"}>
        {label}
      </Text>
      {hint && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {hint}
        </Text>
      )}
    </div>
    <Text
      size="small"
      weight={strong ? "plus" : "regular"}
      className={
        tone === "positive"
          ? "text-ui-fg-interactive"
          : tone === "negative"
            ? "text-ui-fg-error"
            : tone === "muted"
              ? "text-ui-fg-subtle"
              : undefined
      }
    >
      {value}
    </Text>
  </div>
)

const OrderMargin = ({ data }: { data: { id: string } }) => {
  const [margin, setMargin] = useState<Margin | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/admin/orders/${data.id}/margin`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json())?.message || "Failed")
        return r.json()
      })
      .then((m) => alive && setMargin(m))
      .catch((e) => alive && setError(e?.message || "Could not load"))
    return () => {
      alive = false
    }
  }, [data.id])

  if (error) {
    return (
      <Container className="p-0 divide-y">
        <div className="px-6 py-4">
          <Heading level="h2">Profit breakdown</Heading>
          <Text size="small" className="text-ui-fg-error mt-2">
            {error}
          </Text>
        </div>
      </Container>
    )
  }

  if (!margin) return null

  const c = margin.costs
  const r = margin.revenue

  return (
    <Container className="p-0 divide-y">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Profit breakdown</Heading>
        <Badge size="2xsmall" color={margin.complete ? "green" : "orange"}>
          {margin.complete ? "Complete" : "Partial"}
        </Badge>
      </div>

      <div className="px-6 py-3">
        <Text size="xsmall" weight="plus" className="text-ui-fg-subtle uppercase">
          Revenue
        </Text>
        <Row label="Merchandise (net of GST)" value={inr(r.merchandise_net)} />
        {r.services_net > 0 && (
          <Row
            label="Gift wrap / COD fee"
            value={inr(r.services_net)}
            hint="cost recovery, not merchandise"
          />
        )}
        <Row label="Shipping charged" value={inr(r.shipping_charged)} />
        {r.discount > 0 && (
          <Row
            label="Coupon discount"
            value={`− ${inr(r.discount)}`}
            tone="muted"
            hint="already reflected above"
          />
        )}
        <Row
          label="GST collected"
          value={inr(r.tax_collected)}
          tone="muted"
          hint="passed to government, not margin"
        />
      </div>

      <div className="px-6 py-3">
        <Text size="xsmall" weight="plus" className="text-ui-fg-subtle uppercase">
          Costs
        </Text>
        <Row
          label="Product cost"
          value={c.cogs_known ? `− ${inr(c.cogs)}` : `− ${inr(c.cogs)}`}
          tone="negative"
          hint={
            c.cogs_known
              ? undefined
              : `cost price not set: ${c.missing_cost_items.join(", ")}`
          }
        />
        <Row
          label="Shipping paid"
          value={c.shipping_actual === null ? "—" : `− ${inr(c.shipping_actual)}`}
          tone={c.shipping_actual === null ? "muted" : "negative"}
          hint={
            c.shipping_actual === null
              ? "unknown until a courier is assigned"
              : c.courier_name || undefined
          }
        />
        <Row
          label="Payment gateway fee"
          value={`− ${inr(c.gateway_fee)}`}
          tone="negative"
          hint={`estimated ${c.gateway_fee_basis.percent}% + ${c.gateway_fee_basis.gst_on_fee_percent}% GST on ${inr(c.gateway_fee_basis.charged_on)}${c.gateway_fee_basis.is_cod ? " (COD upfront only)" : ""}`}
        />
      </div>

      <div className="px-6 py-3">
        <Row
          label="Shipping margin"
          value={
            margin.shipping_margin === null
              ? "—"
              : inr(margin.shipping_margin)
          }
          hint={
            margin.shipping_margin === null
              ? "needs an assigned courier"
              : "charged − paid"
          }
          tone={
            margin.shipping_margin === null
              ? "muted"
              : margin.shipping_margin >= 0
                ? "positive"
                : "negative"
          }
        />
        <Row
          label="Gross profit"
          value={inr(margin.gross_profit)}
          strong
          tone={margin.gross_profit >= 0 ? "positive" : "negative"}
          hint={
            margin.margin_percent !== null
              ? `${margin.margin_percent}% of merchandise revenue`
              : undefined
          }
        />
        {!margin.complete && (
          <Text size="xsmall" className="text-ui-fg-subtle mt-2">
            Figures exclude anything marked “—”. Set cost prices on the product
            page and assign a courier to complete this.
          </Text>
        )}
      </div>

      {margin.lines.length > 0 && (
        <div className="px-6 py-3">
          <Text
            size="xsmall"
            weight="plus"
            className="text-ui-fg-subtle uppercase mb-1"
          >
            Per item
          </Text>
          {margin.lines.map((l, i) => (
            <Row
              key={i}
              label={`${l.title} × ${l.quantity}`}
              value={l.cost_known ? inr(l.profit) : "cost not set"}
              tone={
                !l.cost_known
                  ? "muted"
                  : (l.profit ?? 0) >= 0
                    ? "positive"
                    : "negative"
              }
              hint={`${inr(l.revenue_net)} net${l.cost_known ? ` − ${inr(l.cost)} cost` : ""}`}
            />
          ))}
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
})

export default OrderMargin
