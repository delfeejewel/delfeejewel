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
  const cc = order.currency_code
  const fmt = (amount: number) => convertToLocale({ amount, currency_code: cc })

  const isCod = (payment?.provider_id || "").startsWith("pp_cod")
  const codUpfront = Number((order.metadata as any)?.cod_upfront_amount) || 0
  const dueOnDelivery = Math.max(0, (Number(order.total) || 0) - codUpfront)

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
            <div className="flex items-start gap-2">
              <Container className="flex items-center h-7 w-fit p-2 bg-ui-button-neutral-hover">
                {paymentInfoMap[payment.provider_id]?.icon}
              </Container>
              <div
                className="text-[var(--color-text-primary)]"
                data-testid="payment-amount"
              >
                {isCod && codUpfront > 0 ? (
                  // COD with an advance token: show token paid + balance due.
                  <>
                    <p>
                      <span className="text-[var(--color-text-muted)]">
                        Advance paid:
                      </span>{" "}
                      {fmt(codUpfront)}
                    </p>
                    <p>
                      <span className="text-[var(--color-text-muted)]">
                        Due on delivery:
                      </span>{" "}
                      <span className="font-semibold">{fmt(dueOnDelivery)}</span>
                    </p>
                  </>
                ) : isCod ? (
                  // Plain COD, nothing collected upfront.
                  <p>
                    <span className="font-semibold">{fmt(Number(order.total) || 0)}</span>{" "}
                    due on delivery
                  </p>
                ) : (
                  // Online payment — captured in full.
                  <p>
                    {fmt(payment.amount)} paid on{" "}
                    {new Date(payment.created_at ?? "").toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "short", year: "numeric" }
                    )}
                  </p>
                )}
              </div>
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
