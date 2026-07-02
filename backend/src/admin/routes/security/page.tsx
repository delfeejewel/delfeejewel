import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ShieldCheck } from "@medusajs/icons"
import {
  Container,
  Heading,
  Button,
  Input,
  Text,
  Badge,
  toast,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

type Status = {
  enabled: boolean
  pending: boolean
  backup_codes_remaining: number
  enrolled_at: string | null
}

const api = async (path: string, method = "GET", body?: any) => {
  const r = await fetch(path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data?.message || `HTTP ${r.status}`)
  return data
}

const SecurityPage = () => {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // enrolment working state
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null)
  const [code, setCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [disableCode, setDisableCode] = useState("")

  const load = () => {
    setLoading(true)
    api("/admin/2fa/status")
      .then(setStatus)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const beginSetup = async () => {
    setBusy(true)
    try {
      const r = await api("/admin/2fa/setup", "POST")
      setSetup({ qr: r.qr, secret: r.secret })
      setBackupCodes(null)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const confirmEnable = async () => {
    setBusy(true)
    try {
      const r = await api("/admin/2fa/enable", "POST", { code: code.trim() })
      setBackupCodes(r.backup_codes)
      setSetup(null)
      setCode("")
      toast.success("Two-factor authentication enabled.")
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    if (!window.confirm("Turn off two-factor authentication for your account?")) return
    setBusy(true)
    try {
      await api("/admin/2fa/disable", "POST", { code: disableCode.trim() })
      setDisableCode("")
      setBackupCodes(null)
      toast.success("Two-factor authentication disabled.")
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const box: React.CSSProperties = {
    padding: 16,
    borderRadius: 12,
    border: "1px solid var(--border-base)",
    background: "var(--bg-subtle)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  }

  return (
    <Container>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
        <div>
          <Heading level="h1">Two-Factor Authentication</Heading>
          <Text size="small" style={{ color: "var(--fg-subtle)", marginTop: 4 }}>
            Protect your account with a time-based code from an authenticator app
            (Google Authenticator, Authy, Microsoft Authenticator).
          </Text>
        </div>

        {loading && <Text size="small">Loading…</Text>}

        {/* Backup codes — shown once right after enabling */}
        {backupCodes && (
          <div style={{ ...box, borderColor: "var(--tag-orange-border)", background: "var(--tag-orange-bg)" }}>
            <Text style={{ fontWeight: 700, color: "var(--tag-orange-text)" }}>
              Save your backup codes
            </Text>
            <Text size="small" style={{ color: "var(--tag-orange-text)" }}>
              Each code works once if you lose your authenticator. They will not be
              shown again.
            </Text>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                fontFamily: "monospace",
                fontSize: 14,
              }}
            >
              {backupCodes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <div>
              <Button
                size="small"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(backupCodes.join("\n"))
                  toast.success("Backup codes copied.")
                }}
              >
                Copy codes
              </Button>
            </div>
          </div>
        )}

        {!loading && status && !status.enabled && !setup && (
          <div style={box}>
            <Badge color="grey" size="small">Disabled</Badge>
            <Text size="small">
              Two-factor authentication is currently off for your account.
            </Text>
            <div>
              <Button onClick={beginSetup} disabled={busy} isLoading={busy}>
                Enable 2FA
              </Button>
            </div>
          </div>
        )}

        {/* Enrolment: scan QR + confirm a code */}
        {setup && (
          <div style={box}>
            <Text style={{ fontWeight: 600 }}>1. Scan this QR in your authenticator app</Text>
            <img src={setup.qr} alt="2FA QR code" style={{ width: 180, height: 180 }} />
            <Text size="xsmall" style={{ color: "var(--fg-subtle)" }}>
              Can’t scan? Enter this key manually:{" "}
              <span style={{ fontFamily: "monospace" }}>{setup.secret}</span>
            </Text>
            <Text style={{ fontWeight: 600, marginTop: 4 }}>2. Enter the 6-digit code</Text>
            <div style={{ display: "flex", gap: 8 }}>
              <Input
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={{ maxWidth: 160 }}
              />
              <Button onClick={confirmEnable} disabled={busy || !code.trim()} isLoading={busy}>
                Verify & enable
              </Button>
              <Button variant="secondary" onClick={() => { setSetup(null); setCode("") }} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!loading && status && status.enabled && (
          <div style={box}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge color="green" size="small">Enabled</Badge>
              <Text size="small" style={{ color: "var(--fg-subtle)" }}>
                {status.backup_codes_remaining} backup codes remaining
              </Text>
            </div>
            <Text size="small">
              To turn off 2FA, enter a current code from your authenticator (or a
              backup code).
            </Text>
            <div style={{ display: "flex", gap: 8 }}>
              <Input
                placeholder="Current code"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                style={{ maxWidth: 200 }}
              />
              <Button variant="danger" onClick={disable} disabled={busy || !disableCode.trim()} isLoading={busy}>
                Disable 2FA
              </Button>
            </div>
          </div>
        )}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Security",
  icon: ShieldCheck,
})

export default SecurityPage
