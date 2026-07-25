import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"

/**
 * Best-effort cosmetic lockout: an "employee" (packing/dispatch) login only
 * needs the Packing page. Medusa's admin-sdk has no single "every page" zone,
 * so this is registered on the handful of top-level list pages an employee
 * could actually land on/navigate to and redirects them back to /app/packing.
 * NOT a security boundary — that's the server-side shipping.write permission
 * check (src/lib/rbac.ts), which applies regardless of what's visible here.
 */
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
  zone: [
    "order.list.before",
    "order.details.side.before",
    "product.list.before",
    "customer.list.before",
    "promotion.list.before",
  ],
})

export default EmployeeNavRestrictWidget
