import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"

import { startEmployeeNavGuard } from "../lib/hide-employee-nav"

/**
 * Best-effort cosmetic lockout. An "employee" (packing/dispatch) login now
 * holds shipping.write, products.write and orders.write (src/lib/rbac.ts), so
 * Packing, the catalogue and Orders are all theirs to work in — only Customers
 * and Promotions are left to bounce back to /app/packing. Medusa's admin-sdk
 * has no single "every page" zone, so the REDIRECT below is registered per
 * page. NOT a security boundary — that's the server-side permission check in
 * src/lib/rbac.ts, which applies regardless of what's visible here.
 *
 * The sidebar NAV HIDING is handled separately by startEmployeeNavGuard(),
 * called once at module scope below (see hide-employee-nav.ts for why it's
 * module-scoped rather than tied to this component's mount).
 */
startEmployeeNavGuard()

const EmployeeNavRestrictWidget = () => {
  useEffect(() => {
    if (window.location.pathname.startsWith("/app/packing")) return

    fetch("/admin/users/me", { credentials: "include" })
      .then((r) => r.json())
      .then((body) => {
        const role = body?.user?.metadata?.role
        if (role === "employee") {
          window.location.href = "/app/packing"
        }
      })
      .catch(() => {
        /* on any error, leave the UI untouched */
      })
  }, [])

  return null
}

export const config = defineWidgetConfig({
  zone: ["customer.list.before", "promotion.list.before"],
})

export default EmployeeNavRestrictWidget
