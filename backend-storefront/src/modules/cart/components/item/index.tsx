"use client"

import { useOptimistic, useState, useTransition } from "react"
import { Minus, Plus, Trash2 } from "lucide-react"

import { updateLineItem, deleteLineItem } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import ErrorMessage from "@modules/checkout/components/error-message"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LineItemUnitPrice from "@modules/common/components/line-item-unit-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem
  type?: "full" | "preview"
  currencyCode: string
}

const MAX_QTY = 10

const Item = ({ item, type = "full", currencyCode }: ItemProps) => {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  // Optimistic state: the quantity number and the "removed" flag flip
  // instantly in the browser, then reconcile to the server's truth once the
  // cart revalidation lands. Line totals still come from the server.
  const [optimisticQty, setOptimisticQty] = useOptimistic(item.quantity)
  const [optimisticRemoved, setOptimisticRemoved] = useOptimistic(false)

  // Clamp to available stock (when inventory is managed) as well as the sane
  // per-line max, so the stepper can't overshoot what the server will accept.
  const invQty = (item.variant as any)?.inventory_quantity
  const maxQty =
    (item.variant as any)?.manage_inventory && typeof invQty === "number"
      ? Math.max(1, Math.min(MAX_QTY, invQty))
      : MAX_QTY

  const setQuantity = (next: number) => {
    if (next < 1 || next > maxQty || next === optimisticQty) return
    setError(null)
    startTransition(async () => {
      setOptimisticQty(next)
      try {
        await updateLineItem({ lineId: item.id, quantity: next })
      } catch (e: any) {
        setError(e?.message || "Could not update quantity")
      }
    })
  }

  const remove = () => {
    setError(null)
    startTransition(async () => {
      setOptimisticRemoved(true)
      try {
        await deleteLineItem(item.id)
      } catch (e: any) {
        setError(e?.message || "Could not remove item")
      }
    })
  }

  // Vanish instantly on remove; if the server call fails the optimistic flag
  // rolls back and the row reappears with the error.
  if (optimisticRemoved) {
    return null
  }

  // Compact preview row (used by mini-cart / cart dropdown)
  if (type === "preview") {
    return (
      <div className="flex items-start gap-3 py-3" data-testid="product-row">
        <LocalizedClientLink
          href={`/products/${item.product_handle}`}
          className="block w-16 shrink-0"
        >
          <div className="rounded-lg overflow-hidden border border-[var(--color-border)]">
            <Thumbnail
              thumbnail={item.thumbnail}
              images={item.variant?.product?.images}
              size="square"
            />
          </div>
        </LocalizedClientLink>
        <div className="flex-1 min-w-0">
          <LocalizedClientLink
            href={`/products/${item.product_handle}`}
            className="text-[13px] font-semibold text-[var(--color-text-primary)] line-clamp-1 hover:text-[var(--color-plum)] transition-colors"
            data-testid="product-title"
          >
            {item.product_title}
          </LocalizedClientLink>
          <LineItemOptions variant={item.variant} data-testid="product-variant" />
          <div className="text-[11.5px] text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1 flex-wrap">
            <span>{optimisticQty} ×</span>
            <span className="text-[var(--color-text-primary)]">
              <LineItemUnitPrice
                item={item}
                style="tight"
                currencyCode={currencyCode}
              />
            </span>
          </div>
        </div>
        <div className="text-[13.5px] font-bold text-[var(--color-plum)] tabular-nums shrink-0">
          <LineItemPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </div>
      </div>
    )
  }

  // Full row on /cart
  return (
    <div
      className="flex items-start gap-4 p-3 small:p-4 rounded-2xl bg-white border border-[var(--color-lavender)]"
      data-testid="product-row"
    >
      <LocalizedClientLink
        href={`/products/${item.product_handle}`}
        className="block w-20 small:w-24 shrink-0"
      >
        <div className="rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <Thumbnail
            thumbnail={item.thumbnail}
            images={item.variant?.product?.images}
            size="square"
          />
        </div>
      </LocalizedClientLink>

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <LocalizedClientLink
              href={`/products/${item.product_handle}`}
              className="text-[14px] small:text-[15px] font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-plum)] transition-colors line-clamp-2"
              data-testid="product-title"
            >
              {item.product_title}
            </LocalizedClientLink>
            <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">
              <LineItemOptions
                variant={item.variant}
                data-testid="product-variant"
              />
            </div>
            <div className="text-[11.5px] text-[var(--color-text-muted)] mt-1.5 flex items-center gap-1 flex-wrap">
              <span>Unit</span>
              <LineItemUnitPrice
                item={item}
                style="tight"
                currencyCode={currencyCode}
              />
            </div>
          </div>

          <div className="text-[14px] small:text-[15px] font-bold text-[var(--color-plum)] tabular-nums whitespace-nowrap shrink-0">
            <LineItemPrice
              item={item}
              style="tight"
              currencyCode={currencyCode}
            />
          </div>
        </div>

        {/* Qty + remove */}
        <div className="flex items-center justify-between mt-1">
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setQuantity(optimisticQty - 1)}
              disabled={isPending || optimisticQty <= 1}
              className="w-8 h-8 rounded-md bg-white border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-plum)] disabled:opacity-40 disabled:hover:border-[var(--color-border)] transition-colors"
              aria-label="Decrease quantity"
              data-testid="product-decrease-button"
            >
              <Minus size={12} />
            </button>
            <span className="min-w-[28px] text-center text-[13.5px] font-semibold tabular-nums">
              {optimisticQty}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(optimisticQty + 1)}
              disabled={isPending || optimisticQty >= maxQty}
              className="w-8 h-8 rounded-md bg-white border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-plum)] disabled:opacity-40 disabled:hover:border-[var(--color-border)] transition-colors"
              aria-label="Increase quantity"
              data-testid="product-increase-button"
            >
              <Plus size={12} />
            </button>
            {isPending && (
              <span className="w-3.5 h-3.5 border-2 border-[var(--color-plum)] border-t-transparent rounded-full animate-spin ml-1" />
            )}
          </div>

          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--color-text-muted)] hover:text-red-600 transition-colors py-1 px-2 -mx-2 rounded-md disabled:opacity-50"
            aria-label="Remove item"
            data-testid="product-delete-button"
          >
            <Trash2 size={13} strokeWidth={1.6} />
            Remove
          </button>
        </div>

        {error && (
          <ErrorMessage error={error} data-testid="product-error-message" />
        )}
      </div>
    </div>
  )
}

export default Item
