import { Metadata } from "next"

import Overview from "@modules/account/components/overview"
import { notFound } from "next/navigation"
import { retrieveCustomer } from "@lib/data/customer"
import { listOrders } from "@lib/data/orders"
import { getMyReviews } from "@lib/data/reviews"
import ReviewPopup from "@modules/reviews/components/review-popup"

export const metadata: Metadata = {
  title: "Account",
  description: "Overview of your account activity.",
}

export default async function OverviewTemplate() {
  const customer = await retrieveCustomer().catch(() => null)
  const orders = (await listOrders().catch(() => null)) || null

  if (!customer) {
    notFound()
  }

  const { pending } = await getMyReviews()

  return (
    <>
      <Overview customer={customer} orders={orders} />
      <ReviewPopup pending={pending} />
    </>
  )
}
