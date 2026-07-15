import { Metadata } from "next"

import { getFeatureFlags } from "@lib/data/feature-flags"
import { getMyReturnRequests } from "@lib/data/returns"
import AccountReturns from "@modules/returns/components/account-returns"

export const metadata: Metadata = {
  title: "Returns",
  description: "Track your return requests.",
}

export default async function ReturnsPage() {
  const flags = await getFeatureFlags()
  if (!flags.returns_enabled) {
    return (
      <div className="bg-white rounded-2xl border border-[var(--color-lavender)] p-8 text-center">
        <h1 className="font-wittgenstein text-[22px] font-semibold text-[var(--color-plum)] mb-2">
          Returns are currently unavailable
        </h1>
        <p className="text-[14px] text-[var(--color-text-secondary)]">
          Online returns are not available right now. Please contact us and
          we&apos;ll help you with your order.
        </p>
      </div>
    )
  }

  const requests = await getMyReturnRequests()
  return <AccountReturns requests={requests} />
}
