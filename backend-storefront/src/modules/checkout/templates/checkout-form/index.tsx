import { listCartPaymentMethods } from "@lib/data/payment"
import { HttpTypes } from "@medusajs/types"
import Addresses from "@modules/checkout/components/addresses"
import Payment from "@modules/checkout/components/payment"
import Review from "@modules/checkout/components/review"

export default async function CheckoutForm({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) {
  if (!cart) {
    return null
  }

  const paymentMethods = await listCartPaymentMethods(cart.region?.id ?? "")

  if (!paymentMethods) {
    return null
  }

  // Delivery is no longer a manual step — a default "standard" shipping method
  // is auto-selected when the address is saved (see setAddresses).
  return (
    <div className="w-full grid grid-cols-1 gap-y-4 small:gap-y-5">
      <Addresses cart={cart} customer={customer} />

      <Payment cart={cart} availablePaymentMethods={paymentMethods} />

      <Review cart={cart} />
    </div>
  )
}
