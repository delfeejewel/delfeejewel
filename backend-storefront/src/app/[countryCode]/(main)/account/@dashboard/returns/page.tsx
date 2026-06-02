import { Metadata } from "next"

import { getMyReturnRequests } from "@lib/data/returns"
import AccountReturns from "@modules/returns/components/account-returns"

export const metadata: Metadata = {
  title: "Returns",
  description: "Track your return requests.",
}

export default async function ReturnsPage() {
  const requests = await getMyReturnRequests()
  return <AccountReturns requests={requests} />
}
