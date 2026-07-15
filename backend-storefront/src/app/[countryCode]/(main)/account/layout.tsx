import { retrieveCustomer } from "@lib/data/customer"
import { getFeatureFlags } from "@lib/data/feature-flags"
import { Toaster } from "@medusajs/ui"
import AccountLayout from "@modules/account/templates/account-layout"

export default async function AccountPageLayout({
  dashboard,
  login,
}: {
  dashboard?: React.ReactNode
  login?: React.ReactNode
}) {
  const [customer, flags] = await Promise.all([
    retrieveCustomer().catch(() => null),
    getFeatureFlags(),
  ])

  return (
    <AccountLayout customer={customer} returnsEnabled={flags.returns_enabled}>
      {customer ? dashboard : login}
      <Toaster />
    </AccountLayout>
  )
}
