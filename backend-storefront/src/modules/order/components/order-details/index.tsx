import { HttpTypes } from "@medusajs/types"

type OrderDetailsProps = {
  order: HttpTypes.StoreOrder
  showStatus?: boolean
}

const OrderDetails = ({ order, showStatus }: OrderDetailsProps) => {
  const formatStatus = (str: string) => {
    const formatted = str.split("_").join(" ")
    return formatted.slice(0, 1).toUpperCase() + formatted.slice(1)
  }

  const date = new Date(order.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  })

  return (
    <div className="text-[13px] small:text-[14px] text-[var(--color-text-secondary)] leading-relaxed">
      <p>
        We&apos;ve sent the order confirmation to{" "}
        <span
          className="font-semibold text-[var(--color-text-primary)] break-words"
          data-testid="order-email"
        >
          {order.email}
        </span>
        .
      </p>

      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3">
        <p>
          Order date:{" "}
          <span
            className="font-medium text-[var(--color-text-primary)]"
            data-testid="order-date"
          >
            {date}
          </span>
        </p>
        <p>
          Order number:{" "}
          <span
            className="font-semibold text-[var(--color-plum)]"
            data-testid="order-id"
          >
            #{order.display_id}
          </span>
        </p>
      </div>

      {showStatus && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-3">
          <p>
            Order status:{" "}
            <span
              className="font-medium text-[var(--color-text-primary)]"
              data-testid="order-status"
            >
              {formatStatus(order.fulfillment_status)}
            </span>
          </p>
          <p>
            Payment status:{" "}
            <span
              className="font-medium text-[var(--color-text-primary)]"
              data-testid="order-payment-status"
            >
              {formatStatus(order.payment_status)}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

export default OrderDetails
