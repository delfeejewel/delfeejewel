import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Input, Text, Heading } from "@medusajs/ui"
import { useState } from "react"

/**
 * Login-screen widget that adds a two-factor-aware sign-in path.
 *
 * Design choice: this is ADDITIVE — it does NOT hide or replace the stock
 * email+password form, so it can never break normal login. Admins with 2FA
 * enabled expand this panel and sign in with their code; everyone else keeps
 * using the standard form above.
 *
 * Flow: POST /auth/user/emailpass (with totp/backup_code) → on success POST
 * /auth/session to set the cookie → redirect into the dashboard. If the backend
 * returns TWO_FACTOR_REQUIRED, we reveal the code field.
 */
const LoginTwoFactorWidget = () => {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [needsCode, setNeedsCode] = useState(false)
  const [useBackup, setUseBackup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const signIn = async () => {
    setBusy(true)
    setError(null)
    try {
      const body: any = { email: email.trim(), password }
      if (needsCode && code.trim()) {
        if (useBackup) body.backup_code = code.trim()
        else body.totp = code.trim()
      }
      const r = await fetch("/auth/user/emailpass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await r.json().catch(() => ({}))

      if (!r.ok) {
        if (data?.message === "TWO_FACTOR_REQUIRED") {
          setNeedsCode(true)
          setError("Enter the code from your authenticator app.")
        } else if (needsCode) {
          setError("That code is incorrect or expired.")
        } else {
          setError("Invalid email or password.")
        }
        return
      }

      // Exchange the bearer token for a dashboard session cookie, then enter.
      await fetch("/auth/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.token}` },
        credentials: "include",
      })
      window.location.href = "/app"
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <Button variant="transparent" size="small" onClick={() => setOpen(true)}>
          Sign in with two-factor authentication
        </Button>
      </div>
    )
  }

  return (
    <div
      style={{
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        border: "1px solid var(--border-base)",
        background: "var(--bg-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <Heading level="h3">Two-factor sign-in</Heading>
      <Input
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {needsCode && (
        <>
          <Input
            placeholder={useBackup ? "Backup code (abcd-efgh)" : "6-digit code"}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && signIn()}
          />
          <Button
            variant="transparent"
            size="small"
            onClick={() => setUseBackup((v) => !v)}
          >
            {useBackup ? "Use authenticator code instead" : "Use a backup code"}
          </Button>
        </>
      )}
      {error && (
        <Text size="small" style={{ color: needsCode ? "var(--fg-subtle)" : "#b91c1c" }}>
          {error}
        </Text>
      )}
      <Button onClick={signIn} disabled={busy || !email.trim() || !password} isLoading={busy}>
        {needsCode ? "Verify & sign in" : "Sign in"}
      </Button>
      <Button variant="transparent" size="small" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "login.before",
})

export default LoginTwoFactorWidget
