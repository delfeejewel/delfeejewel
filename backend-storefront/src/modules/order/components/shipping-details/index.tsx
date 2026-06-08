import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type ShippingDetailsProps = {
  order: HttpTypes.StoreOrder
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-[var(--color-text-muted)] mb-1.5">
    {children}
  </p>
)

const ShippingDetails = ({ order }: ShippingDetailsProps) => {
  const a = order.shipping_address

  return (
    <div>
      <h2 className="font-wittgenstein text-[18px] small:text-[20px] font-bold text-[var(--color-plum)] mb-3 small:mb-4">
        Delivery
      </h2>
      <div className="grid grid-cols-1 small:grid-cols-3 gap-5 text-[13px]">
        <div data-testid="shipping-address-summary">
          <Label>Ship to</Label>
          <p className="text-[var(--color-text-primary)] leading-relaxed">
            {a?.first_name} {a?.last_name}
            <br />
            {a?.address_1}
            {a?.address_2 ? `, ${a.address_2}` : ""}
            <br />
            {a?.postal_code}, {a?.city}
            <br />
            {a?.country_code?.toUpperCase()}
          </p>
        </div>

        <div data-testid="shipping-contact-summary">
          <Label>Contact</Label>
          <p className="text-[var(--color-text-primary)] leading-relaxed break-words">
            {a?.phone}
            <br />
            {order.email}
          </p>
        </div>

        <div data-testid="shipping-method-summary">
          <Label>Method</Label>
          <p className="text-[var(--color-text-primary)] leading-relaxed">
            {(order as any).shipping_methods?.[0]?.name}{" "}
            <span className="text-[var(--color-plum)] tabular-nums">
              {convertToLocale({
                amount: order.shipping_methods?.[0]?.total ?? 0,
                currency_code: order.currency_code,
              })}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default ShippingDetails
