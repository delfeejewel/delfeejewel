import { HttpTypes } from "@medusajs/types"

import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LineItemUnitPrice from "@modules/common/components/line-item-unit-price"
import Thumbnail from "@modules/products/components/thumbnail"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem
  currencyCode: string
}

const Item = ({ item, currencyCode }: ItemProps) => {
  return (
    <div
      className="flex items-start gap-3 small:gap-4 py-4 border-b border-[var(--color-border)] last:border-b-0"
      data-testid="product-row"
    >
      <div className="w-14 small:w-16 shrink-0">
        <Thumbnail thumbnail={item.thumbnail} size="square" />
      </div>

      <div className="flex-1 min-w-0">
        <p
          className="text-[14px] font-medium text-[var(--color-text-primary)] break-words"
          data-testid="product-name"
        >
          {item.product_title}
        </p>
        <LineItemOptions variant={item.variant} data-testid="product-variant" />
      </div>

      <div className="shrink-0 flex flex-col items-end text-right">
        <span className="flex items-center gap-x-1 text-[12.5px] text-[var(--color-text-muted)] whitespace-nowrap">
          <span data-testid="product-quantity">{item.quantity}</span>x
          <LineItemUnitPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </span>
        <LineItemPrice item={item} style="tight" currencyCode={currencyCode} />
      </div>
    </div>
  )
}

export default Item
