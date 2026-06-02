import { Metadata } from "next"

import TrackOrderTemplate from "@modules/order/templates/track-order-template"

export const metadata: Metadata = {
  title: "Track Your Order",
  description:
    "Track the status of your order — enter your order number and email.",
}

export default function TrackOrderPage() {
  return <TrackOrderTemplate />
}
