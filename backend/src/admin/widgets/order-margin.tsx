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
  breakdown: {
    list_price: { gross: number; net: number; tax: number }
    discount: number
    discount_codes: string[]
    after_discount: { gross: number; net: number; tax: number }
    services: {
      handle: string
      title: string
      gross: number
      net: number
      tax: number
    }[]
    shipping: { gross: number; net: number; tax: number }
    order_total: number
    payment: { is_cod: boolean; paid_online: number; balance_due: number }
  }
  cost_groups: {
    key: string
    label: string
    cost: number | null
    cost_known: boolean
    cost_hint: string | null
    cost_label: string
    collected_label: string | null
    collected_net: number | null
    collected_tax: number
    margin: number | null
  }[]
  costs: {
    cogs: number
    cogs_known: boolean
    missing_cost_items: string[]
    shipping_actual: number | null
    courier_name: string | null
    gateway_fee: number
    gateway_fee_estimated: boolean
    courier_cod_charge: number
    courier_cod_charge_estimated: boolean
    courier_cod_charge_basis: {
      applies: boolean
      flat: number
      percent: number
      gst_on_fee_percent: number
      charged_on: number
    }
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
  const b = margin.breakdown

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
          What the customer paid
        </Text>
        <Row
          label="Selling price"
          value={inr(b.list_price.gross)}
          hint={`${inr(b.list_price.net)} + ${inr(b.list_price.tax)} GST`}
        />
        {b.discount > 0 && (
          <Row
            label={
              b.discount_codes.length
                ? `Discount (${b.discount_codes.join(", ")})`
                : "Discount"
            }
            value={`− ${inr(b.discount)}`}
            tone="negative"
          />
        )}
        {b.discount > 0 && (
          <Row
            label="Price after discount"
            value={inr(b.after_discount.gross)}
            strong
            hint={`${inr(b.after_discount.net)} + ${inr(b.after_discount.tax)} GST`}
          />
        )}
        {b.services.map((s) => (
          <Row
            key={s.handle}
            label={s.title}
            value={`+ ${inr(s.gross)}`}
            hint={
              s.tax > 0
                ? `${inr(s.net)} + ${inr(s.tax)} GST`
                : `${inr(s.net)}, no GST`
            }
          />
        ))}
        <Row
          label="Shipping charged"
          value={`+ ${inr(b.shipping.gross)}`}
          hint={
            b.shipping.tax > 0
              ? `${inr(b.shipping.net)} + ${inr(b.shipping.tax)} GST`
              : "no GST"
          }
        />
        <Row label="Order total" value={inr(b.order_total)} strong />
        <Row
          label="GST collected"
          value={inr(r.tax_collected)}
          tone="muted"
          hint="included in the figures above — passed to government, not margin"
        />
        {b.payment.is_cod && (
          <div className="mt-2 pt-2 border-t border-ui-border-base">
            <Row
              label="Paid online (COD token)"
              value={inr(b.payment.paid_online)}
              tone="positive"
              hint="captured at checkout"
            />
            <Row
              label="To collect on delivery"
              value={inr(b.payment.balance_due)}
              strong
              hint="cash the courier must collect"
            />
          </div>
        )}
      </div>

      <div className="px-6 py-3">
        <Text size="xsmall" weight="plus" className="text-ui-fg-subtle uppercase">
          Costs &amp; recovery
        </Text>
        {margin.cost_groups.map((g) => (
          <div
            key={g.key}
            className="mt-4 pt-4 border-t border-ui-border-base first:mt-2 first:pt-0 first:border-t-0"
          >
            <Text
              size="xsmall"
              weight="plus"
              className="text-ui-fg-base mb-1 block"
            >
              {g.label}
            </Text>
            <Row
              label={g.cost_label}
              value={g.cost === null ? "—" : `− ${inr(g.cost)}`}
              tone={g.cost === null ? "muted" : "negative"}
              hint={g.cost_hint || undefined}
            />
            {g.collected_label !== null && (
              <Row
                label={g.collected_label}
                value={`+ ${inr(g.collected_net ?? 0)}`}
                tone="positive"
                hint={
                  g.collected_tax > 0
                    ? `net of ${inr(g.collected_tax)} GST`
                    : "no GST"
                }
              />
            )}
            <Row
              label="Margin"
              value={g.margin === null ? "—" : inr(g.margin)}
              strong
              tone={
                g.margin === null
                  ? "muted"
                  : g.margin >= 0
                    ? "positive"
                    : "negative"
              }
              hint={g.margin === null ? "needs the cost above" : undefined}
            />
          </div>
        ))}
      </div>

      <div className="px-6 py-3">
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
            {c.courier_cod_charge_estimated &&
              " The courier COD charge is an estimate until the real figure is read from the Shiprocket passbook."}
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
