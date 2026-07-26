import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Input, Button, Badge } from "@medusajs/ui"
import { useEffect, useState } from "react"

/**
 * Settings → Store: lets a developer set/change/clear the shared 4-digit PIN
 * that gates the "employee" role's access to Products (see
 * products-pin-gate.tsx and requireProductsPinForEmployee in middlewares.ts).
 * Developer-only, same pattern as feature-toggles.tsx.
 */
const ProductsPinSettingsWidget = () => {
  const [canManage, setCanManage] = useState(false)
  const [hasPin, setHasPin] = useState(false)
  const [pin, setPin] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/admin/products-pin", { credentials: "include" })
      .then((r) => r.json())
      .then((body) => {
        setCanManage(!!body.can_manage)
        setHasPin(!!body.has_pin)
      })
      .catch(() => setCanManage(false))
  }, [])

  if (!canManage) return null

  const save = async () => {
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN must be exactly 4 digits.")
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const r = await fetch("/admin/products-pin", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
      setHasPin(true)
      setPin("")
      setMessage("PIN saved.")
    } catch (e: any) {
      setError(e?.message || "Could not save the PIN.")
    } finally {
      setSaving(false)
    }
  }

  const clear = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const r = await fetch("/admin/products-pin", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clear: true }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
      setHasPin(false)
      setMessage("PIN removed — employees can no longer unlock Products.")
    } catch (e: any) {
      setError(e?.message || "Could not clear the PIN.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Heading level="h2">Employee Products PIN</Heading>
          <Badge size="2xsmall" color="red">
            Developer
          </Badge>
        </div>
      </div>
      <div className="flex items-center justify-between gap-6 px-6 py-4">
        <div>
          <Text size="small" weight="plus">
            {hasPin ? "PIN is set" : "No PIN set"}
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            The "employee" role must enter this shared 4-digit PIN before
            viewing Products. Unlocking lasts for the browser session.
          </Text>
        </div>
      </div>
      <div className="flex items-center gap-3 px-6 py-4">
        <Input
          placeholder="New 4-digit PIN"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) =>
            setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
          }
        />
        <Button
          onClick={save}
          disabled={saving || pin.length !== 4}
          isLoading={saving}
        >
          Save PIN
        </Button>
        {hasPin && (
          <Button variant="secondary" onClick={clear} disabled={saving}>
            Clear
          </Button>
        )}
      </div>
      {message && (
        <div className="px-6 py-3">
          <Text size="small" className="text-ui-fg-subtle">
            {message}
          </Text>
        </div>
      )}
      {error && (
        <div className="px-6 py-3">
          <Text size="small" className="text-ui-fg-error">
            {error}
          </Text>
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "store.details.after",
})

export default ProductsPinSettingsWidget
