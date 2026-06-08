import { Container } from "@medusajs/ui"

import { paymentInfoMap } from "@lib/constants"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type PaymentDetailsProps = {
  order: HttpTypes.StoreOrder
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-[var(--color-text-muted)] mb-1.5">
    {children}
  </p>
)

const PaymentDetails = ({ order }: PaymentDetailsProps) => {
  const payment = order.payment_collections?.[0]?.payments?.[0]

  return (
    <div>
      <h2 className="font-wittgenstein text-[18px] small:text-[20px] font-bold text-[var(--color-plum)] mb-3 small:mb-4">
        Payment
      </h2>
      {payment ? (
        <div className="grid grid-cols-1 small:grid-cols-2 gap-5 text-[13px]">
          <div>
            <Label>Payment method</Label>
            <p
              className="text-[var(--color-text-primary)]"
              data-testid="payment-method"
            >
              {paymentInfoMap[payment.provider_id]?.title || payment.provider_id}
            </p>
          </div>
          <div>
            <Label>Payment details</Label>
            <div className="flex items-center gap-2">
              <Container className="flex items-center h-7 w-fit p-2 bg-ui-button-neutral-hover">
                {paymentInfoMap[payment.provider_id]?.icon}
              </Container>
              <p
                className="text-[var(--color-text-primary)]"
                data-testid="payment-amount"
              >
                {convertToLocale({
                  amount: payment.amount,
                  currency_code: order.currency_code,
                })}{" "}
                paid on{" "}
                {new Date(payment.created_at ?? "").toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-[var(--color-text-muted)]">
          Payment details will appear here once processed.
        </p>
      )}
    </div>
  )
}

export default PaymentDetails
