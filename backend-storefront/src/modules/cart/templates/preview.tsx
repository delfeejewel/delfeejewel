"use client"

import repeat from "@lib/util/repeat"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"

import Item from "@modules/cart/components/item"
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item"

const HIDDEN_ADDON_HANDLES = new Set(["gift-wrap"])

type ItemsTemplateProps = {
  cart: HttpTypes.StoreCart
}

const ItemsPreviewTemplate = ({ cart }: ItemsTemplateProps) => {
  // Filter add-on line items out of the preview list
  const items = cart.items?.filter(
    (it: any) =>
      !HIDDEN_ADDON_HANDLES.has(it.product_handle) &&
      !HIDDEN_ADDON_HANDLES.has(it.variant?.product?.handle)
  )
  const hasOverflow = items && items.length > 4

  return (
    <div
      className={clx({
        "pl-[1px] overflow-y-scroll overflow-x-hidden no-scrollbar max-h-[420px]":
          hasOverflow,
      })}
      data-testid="items-table"
    >
      <div className="flex flex-col divide-y divide-[var(--color-lavender)]">
        {items
          ? items
              .sort((a, b) =>
                (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
              )
              .map((item) => (
                <Item
                  key={item.id}
                  item={item}
                  type="preview"
                  currencyCode={cart.currency_code}
                />
              ))
          : repeat(3).map((i) => <SkeletonLineItem key={i} />)}
      </div>
    </div>
  )
}

export default ItemsPreviewTemplate
