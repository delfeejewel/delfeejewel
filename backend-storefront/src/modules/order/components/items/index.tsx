import { HttpTypes } from "@medusajs/types"

import Item from "@modules/order/components/item"

type ItemsProps = {
  order: HttpTypes.StoreOrder
}

const Items = ({ order }: ItemsProps) => {
  const items = order.items

  return (
    <div className="flex flex-col">
      {items
        ?.slice()
        .sort((a, b) => ((a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1))
        .map((item) => (
          <Item key={item.id} item={item} currencyCode={order.currency_code} />
        ))}
    </div>
  )
}

export default Items
