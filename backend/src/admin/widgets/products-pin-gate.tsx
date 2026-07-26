import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Input, Text, Heading } from "@medusajs/ui"
import { useEffect, useState } from "react"

/**
 * Blocks the "employee" role from viewing Products until the shared 4-digit
 * PIN is entered. Real enforcement is server-side
 * (requireProductsPinForEmployee in middlewares.ts, which 403s
 * /admin/products* for employees without a valid signed unlock cookie) — this
 * overlay is just the UX for that gate. Lock state is detected by probing the
 * real products endpoint (rather than trusting a client-only flag), so the
 * overlay always matches what the server will actually allow.
 */
const ProductsPinGateWidget = () => {
  const [role, setRole] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [checked, setChecked] = useState(false)
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch("/admin/users/me", { credentials: "include" })
      .then((r) => r.json())
      .then((body) => {
        const r = body?.user?.metadata?.role
        setRole(r)
        if (r !== "employee") {
          setChecked(true)
          return
        }
        return fetch("/admin/products?limit=1", {
          credentials: "include",
        }).then((res) => {
          setLocked(res.status === 403)
          setChecked(true)
        })
      })
      .catch(() => setChecked(true))
  }, [])

  const submit = async () => {
    if (pin.length !== 4) return
    setBusy(true)
    setError(null)
    try {
      const r = await fetch("/admin/products-pin/verify", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(data?.message || "Incorrect PIN.")
        return
      }
      // Reload so the core Products page re-fetches now that the unlock
      // cookie is set — this widget only overlays, it can't unblock the
      // dashboard's own already-fired 403'd fetch.
      window.location.reload()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  if (!checked || role !== "employee" || !locked) return null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 320,
          padding: 24,
          borderRadius: 12,
          background: "var(--bg-base)",
          border: "1px solid var(--border-base)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <Heading level="h2">Products PIN required</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Enter the 4-digit PIN to view products.
        </Text>
        <Input
          placeholder="••••"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) =>
            setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
          }
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        {error && (
          <Text size="small" className="text-ui-fg-error">
            {error}
          </Text>
        )}
        <Button
          onClick={submit}
          disabled={busy || pin.length !== 4}
          isLoading={busy}
        >
          Unlock
        </Button>
      </div>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: ["product.list.before", "product.details.side.before"],
})

export default ProductsPinGateWidget
