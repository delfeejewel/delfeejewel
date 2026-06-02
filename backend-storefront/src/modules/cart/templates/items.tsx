import { HttpTypes } from "@medusajs/types"

import Item from "@modules/cart/components/item"
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item"
import repeat from "@lib/util/repeat"

type ItemsTemplateProps = {
  cart?: HttpTypes.StoreCart
}

const HIDDEN_ADDON_HANDLES = new Set(["gift-wrap"])

const ItemsTemplate = ({ cart }: ItemsTemplateProps) => {
  // Filter out add-on line items (gift wrap, etc.) — they have their own UI
  const items = cart?.items?.filter(
    (it: any) =>
      !HIDDEN_ADDON_HANDLES.has(it.product_handle) &&
      !HIDDEN_ADDON_HANDLES.has(it.variant?.product?.handle)
  )
  const total = items?.reduce((s, it) => s + Number(it.quantity || 0), 0) || 0

  return (
    <section>
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="font-wittgenstein text-[20px] small:text-[22px] font-bold text-[var(--color-plum)]">
          Items
        </h2>
        {items && (
          <span className="text-[12px] text-[var(--color-text-muted)]">
            ({total} {total === 1 ? "piece" : "pieces"})
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {items
          ? items
              .sort((a, b) =>
                (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
              )
              .map((item) => (
                <Item
                  key={item.id}
                  item={item}
                  currencyCode={cart?.currency_code || "inr"}
                />
              ))
          : repeat(3).map((i) => <SkeletonLineItem key={i} />)}
      </div>
    </section>
  )
}

export default ItemsTemplate
