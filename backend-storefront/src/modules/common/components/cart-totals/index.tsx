"use client"

import React from "react"

import { convertToLocale } from "@lib/util/money"

type CartTotalsProps = {
  totals: {
    total?: number | null
    subtotal?: number | null
    tax_total?: number | null
    currency_code: string
    item_subtotal?: number | null
    shipping_subtotal?: number | null
    discount_subtotal?: number | null
    credit_line_subtotal?: number | null
  }
}

function Row({
  label,
  value,
  accent,
}: {
  label: React.ReactNode
  value: React.ReactNode
  accent?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-[13.5px]">
      <span
        className={
          accent
            ? "text-green-700 font-semibold"
            : "text-[var(--color-text-secondary)]"
        }
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${
          accent
            ? "text-green-700 font-semibold"
            : "text-[var(--color-text-primary)]"
        }`}
      >
        {value}
      </span>
    </div>
  )
}

const CartTotals: React.FC<CartTotalsProps> = ({ totals }) => {
  const {
    currency_code,
    total,
    tax_total,
    item_subtotal,
    shipping_subtotal,
    discount_subtotal,
    credit_line_subtotal,
  } = totals

  const fmt = (amount: number | null | undefined) =>
    convertToLocale({ amount: amount ?? 0, currency_code })

  return (
    <div className="flex flex-col gap-2.5">
      <Row
        label="Subtotal"
        value={
          <span data-testid="cart-subtotal" data-value={item_subtotal || 0}>
            {fmt(item_subtotal)}
          </span>
        }
      />
      <Row
        label="Shipping"
        value={
          <span
            data-testid="cart-shipping"
            data-value={shipping_subtotal || 0}
          >
            {fmt(shipping_subtotal)}
          </span>
        }
      />
      {!!discount_subtotal && (
        <Row
          accent
          label="Discount"
          value={
            <span data-testid="cart-discount" data-value={discount_subtotal}>
              {`− ${fmt(discount_subtotal)}`}
            </span>
          }
        />
      )}
      {!!credit_line_subtotal && (
        <Row
          accent
          label="Gift card"
          value={
            <span
              data-testid="cart-credit-line"
              data-value={credit_line_subtotal}
            >
              {`− ${fmt(credit_line_subtotal)}`}
            </span>
          }
        />
      )}
      <Row
        label="Taxes"
        value={
          <span data-testid="cart-taxes" data-value={tax_total || 0}>
            {fmt(tax_total)}
          </span>
        }
      />

      <div className="h-px w-full bg-[var(--color-border)] my-2" />

      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--color-plum)]">
          Total
        </span>
        <span
          className="font-wittgenstein text-[24px] font-bold text-[var(--color-plum)] tabular-nums"
          data-testid="cart-total"
          data-value={total || 0}
        >
          {fmt(total)}
        </span>
      </div>
    </div>
  )
}

export default CartTotals
