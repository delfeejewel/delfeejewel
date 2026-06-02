"use client"

import { setAddresses } from "@lib/data/cart"
import compareAddresses from "@lib/util/compare-addresses"
import { CheckCircle2 } from "lucide-react"
import { HttpTypes } from "@medusajs/types"
import { useToggleState } from "@medusajs/ui"
import Spinner from "@modules/common/icons/spinner"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useActionState } from "react"
import BillingAddress from "../billing_address"
import ErrorMessage from "../error-message"
import ShippingAddress from "../shipping-address"
import { SubmitButton } from "../submit-button"

const Addresses = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "address"

  const { state: sameAsBilling, toggle: toggleSameAsBilling } = useToggleState(
    cart?.shipping_address && cart?.billing_address
      ? compareAddresses(cart?.shipping_address, cart?.billing_address)
      : true
  )

  const handleEdit = () => {
    router.push(pathname + "?step=address")
  }

  const [message, formAction] = useActionState(setAddresses, null)

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-lavender)] p-5 small:p-7">
      <div className="flex flex-row items-center justify-between mb-5">
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]">
            Step 1
          </span>
          <h2 className="font-wittgenstein text-[22px] small:text-[24px] font-bold text-[var(--color-plum)] mt-0.5 flex items-center gap-2">
            Shipping Address
            {!isOpen && (
              <CheckCircle2
                size={20}
                className="text-green-600"
                strokeWidth={2}
              />
            )}
          </h2>
        </div>
        {!isOpen && cart?.shipping_address && (
          <button
            onClick={handleEdit}
            className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-plum)] hover:text-[var(--color-plum-deep)] underline-offset-4 hover:underline"
            data-testid="edit-address-button"
          >
            Edit
          </button>
        )}
      </div>
      {isOpen ? (
        <form action={formAction}>
          <div className="pb-8">
            <ShippingAddress
              customer={customer}
              checked={sameAsBilling}
              onChange={toggleSameAsBilling}
              cart={cart}
            />

            {!sameAsBilling && (
              <div>
                <h3 className="font-wittgenstein text-[18px] font-bold text-[var(--color-plum)] pb-4 pt-6">
                  Billing address
                </h3>
                <BillingAddress cart={cart} />
              </div>
            )}
            <SubmitButton className="mt-6" data-testid="submit-address-button">
              Continue to delivery
            </SubmitButton>
            <ErrorMessage error={message} data-testid="address-error-message" />
          </div>
        </form>
      ) : (
        <div>
          {cart && cart.shipping_address ? (
            <div className="grid grid-cols-1 small:grid-cols-3 gap-5 text-[13px]">
              <div data-testid="shipping-address-summary">
                <p className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-[var(--color-text-muted)] mb-1.5">
                  Ship to
                </p>
                <p className="text-[var(--color-text-primary)] font-medium leading-relaxed">
                  {cart.shipping_address.first_name}{" "}
                  {cart.shipping_address.last_name}
                  <br />
                  {cart.shipping_address.address_1}{" "}
                  {cart.shipping_address.address_2}
                  <br />
                  {cart.shipping_address.postal_code},{" "}
                  {cart.shipping_address.city}
                  <br />
                  {cart.shipping_address.country_code?.toUpperCase()}
                </p>
              </div>

              <div data-testid="shipping-contact-summary">
                <p className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-[var(--color-text-muted)] mb-1.5">
                  Contact
                </p>
                <p className="text-[var(--color-text-primary)] font-medium leading-relaxed">
                  {cart.shipping_address.phone}
                  <br />
                  {cart.email}
                </p>
              </div>

              <div data-testid="billing-address-summary">
                <p className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-[var(--color-text-muted)] mb-1.5">
                  Bill to
                </p>
                {sameAsBilling ? (
                  <p className="text-[var(--color-text-muted)] italic">
                    Same as shipping address.
                  </p>
                ) : (
                  <p className="text-[var(--color-text-primary)] font-medium leading-relaxed">
                    {cart.billing_address?.first_name}{" "}
                    {cart.billing_address?.last_name}
                    <br />
                    {cart.billing_address?.address_1}{" "}
                    {cart.billing_address?.address_2}
                    <br />
                    {cart.billing_address?.postal_code},{" "}
                    {cart.billing_address?.city}
                    <br />
                    {cart.billing_address?.country_code?.toUpperCase()}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <Spinner />
          )}
        </div>
      )}
    </div>
  )
}

export default Addresses
