import { Metadata } from "next"
import { notFound } from "next/navigation"

import OrderOverview from "@modules/account/components/order-overview"
import { listOrders } from "@lib/data/orders"

export const metadata: Metadata = {
  title: "Order History",
  description: "Overview of your previous orders.",
}

export default async function Orders() {
  const orders = await listOrders()

  if (!orders) {
    notFound()
  }

  return (
    <div className="w-full" data-testid="orders-page-wrapper">
      <header className="mb-8 tablet:mb-10">
        <h1 className="font-wittgenstein text-[28px] tablet:text-[36px] font-bold text-[var(--color-plum)] mb-1.5">
          Order History
        </h1>
        <p className="text-[14px] text-[var(--color-text-muted)]">
          Keep track of your collection and manage past purchases.
        </p>
      </header>

      <OrderOverview orders={orders} />
    </div>
  )
}
