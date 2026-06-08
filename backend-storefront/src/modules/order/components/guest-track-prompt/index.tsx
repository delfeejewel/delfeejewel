import { PackageSearch } from "lucide-react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

/**
 * Shown to guests on the order-confirmed page. No account needed — guests track
 * their order via the link in the confirmation email or the /track-order page
 * (order number + email). An optional account CTA is offered separately.
 */
const GuestTrackPrompt = ({ order }: { order: HttpTypes.StoreOrder }) => {
  const orderNo = (order as any).display_id

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-lavender)] overflow-hidden">
      <div className="h-1 [background:linear-gradient(90deg,var(--color-gold),var(--color-plum),var(--color-gold))]" />
      <div className="p-5 small:p-7 flex flex-col small:flex-row small:items-center gap-4 small:gap-5 justify-between">
        <div className="flex items-start gap-3 small:gap-4">
          <span className="flex h-10 w-10 small:h-11 small:w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-lavender)]/60 text-[var(--color-plum)]">
            <PackageSearch size={18} />
          </span>
          <div>
            <h3 className="font-wittgenstein text-[17px] small:text-[19px] font-bold text-[var(--color-plum)] leading-snug">
              Track your order — no account needed
            </h3>
            <p className="text-[12.5px] small:text-[13px] text-[var(--color-text-secondary)] mt-1 leading-relaxed max-w-xl">
              We&apos;ve emailed a confirmation with a one-tap{" "}
              <span className="font-semibold text-[var(--color-text-primary)]">
                Track Your Order
              </span>{" "}
              link
              {orderNo ? (
                <>
                  {" "}
                  for order{" "}
                  <span className="font-semibold text-[var(--color-plum)]">
                    #{orderNo}
                  </span>
                </>
              ) : null}
              . You can also track anytime with your order number and email.
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <LocalizedClientLink
            href="/track-order"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <PackageSearch size={15} />
            Track Your Order
          </LocalizedClientLink>
        </div>
      </div>
    </div>
  )
}

export default GuestTrackPrompt
