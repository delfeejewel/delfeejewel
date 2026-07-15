import React from "react"

import AccountNav from "../components/account-nav"
import { HttpTypes } from "@medusajs/types"

interface AccountLayoutProps {
  customer: HttpTypes.StoreCustomer | null
  returnsEnabled?: boolean
  children: React.ReactNode
}

const AccountLayout: React.FC<AccountLayoutProps> = ({
  customer,
  returnsEnabled = true,
  children,
}) => {
  return (
    <div
      className="flex-1 font-outfit bg-[var(--color-bg-primary)]"
      data-testid="account-page"
    >
      <div className="page-container py-8 small:py-14">
        {customer ? (
          <div className="grid grid-cols-1 small:grid-cols-[280px_1fr] gap-10">
            <div>
              <AccountNav customer={customer} returnsEnabled={returnsEnabled} />
            </div>
            <div className="flex-1">{children}</div>
          </div>
        ) : (
          <div className="flex-1">{children}</div>
        )}
      </div>
    </div>
  )
}

export default AccountLayout
