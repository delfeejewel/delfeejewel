import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Checkout",
}

export default async function Checkout({
  params,
  searchParams,
}: {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ step?: string }>
}) {
  const [cart, customer] = await Promise.all([
    retrieveCart(),
    retrieveCustomer(),
  ])

  if (!cart) {
    return notFound()
  }

  // Always land on an explicit step so the right section opens (e.g. the
  // address form in input mode). Without this, entering checkout via "Buy it
  // Now" or a direct URL has no ?step= and the address step stays collapsed
  // with an empty summary. Mirrors the cart's getCheckoutStep logic.
  const { step } = await searchParams
  if (!step) {
    const { countryCode } = await params
    const next =
      !cart.shipping_address?.address_1 || !cart.email ? "address" : "payment"
    redirect(`/${countryCode}/checkout?step=${next}`)
  }

  return (
    <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] content-container gap-x-40 py-12">
      <CheckoutForm cart={cart} customer={customer} />
      <CheckoutSummary cart={cart} />
    </div>
  )
}
