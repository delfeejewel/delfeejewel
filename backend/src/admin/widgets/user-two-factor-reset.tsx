import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Button, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

/**
 * User-detail widget letting a DEVELOPER reset another admin's 2FA (lost
 * authenticator + backup codes). Renders nothing for non-developers. The
 * backend route (/admin/2fa/reset) enforces the developer gate regardless —
 * this just hides the control from those who can't use it.
 */
const UserTwoFactorResetWidget = ({ data }: { data: { id: string } }) => {
  const [isDeveloper, setIsDeveloper] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch("/admin/users/me", { credentials: "include" })
      .then((r) => r.json())
      .then((b) => setIsDeveloper((b?.user?.metadata?.role || "admin") === "developer"))
      .catch(() => setIsDeveloper(false))
  }, [])

  if (!isDeveloper) return null

  const reset = async () => {
    if (!window.confirm("Reset this user's two-factor authentication? They'll sign in with just their password and must re-enrol.")) return
    setBusy(true)
    try {
      const r = await fetch("/admin/2fa/reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: data.id }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
      toast.success("Two-factor authentication reset for this user.")
    } catch (e: any) {
      toast.error(e?.message || "Reset failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Heading level="h2">Two-Factor Authentication</Heading>
        <Text size="small" style={{ color: "var(--fg-subtle)" }}>
          Reset this user's 2FA if they've lost access to their authenticator and
          backup codes.
        </Text>
        <div>
          <Button variant="secondary" size="small" onClick={reset} disabled={busy} isLoading={busy}>
            Reset 2FA
          </Button>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "user.details.after",
})

export default UserTwoFactorResetWidget
