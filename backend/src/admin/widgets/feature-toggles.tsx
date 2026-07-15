import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Switch, Badge } from "@medusajs/ui"
import { useEffect, useState } from "react"

/**
 * Storefront feature toggles — Settings → Store.
 * Rendered ONLY for developer-role users (the widget returns null for
 * everyone else, and the POST is developer-guarded server-side too).
 *
 * returns_enabled: customer-facing Returns & Exchanges. OFF hides all
 * storefront entry points and blocks new return requests, while the admin
 * side keeps working so the flow stays testable internally.
 */

type Flags = { returns_enabled: boolean }

const FLAG_META: Record<
  keyof Flags,
  { label: string; description: string }
> = {
  returns_enabled: {
    label: "Customer returns & exchanges",
    description:
      "When off, the storefront hides all returns entry points and new return requests are rejected. Admin processing of existing requests keeps working.",
  },
}

const FeatureTogglesWidget = () => {
  const [flags, setFlags] = useState<Flags | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/admin/feature-flags", { credentials: "include" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
        setFlags(body.flags)
        setCanManage(!!body.can_manage)
      })
      .catch(() => {
        // Leave hidden on any error — this panel is developer-only.
        setCanManage(false)
      })
  }, [])

  // Developer-only: everyone else sees nothing at all.
  if (!canManage || !flags) return null

  const toggle = async (key: keyof Flags, value: boolean) => {
    setSaving(key)
    setError(null)
    const prev = flags
    setFlags({ ...flags, [key]: value })
    try {
      const r = await fetch("/admin/feature-flags", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
      setFlags(body.flags)
    } catch (e: any) {
      setFlags(prev)
      setError(e?.message || "Could not save the toggle.")
    } finally {
      setSaving(null)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Heading level="h2">Storefront feature toggles</Heading>
          <Badge size="2xsmall" color="red">
            Developer
          </Badge>
        </div>
      </div>
      {(Object.keys(FLAG_META) as (keyof Flags)[]).map((key) => (
        <div
          key={key}
          className="flex items-center justify-between gap-6 px-6 py-4"
        >
          <div>
            <Text size="small" weight="plus">
              {FLAG_META[key].label}
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              {FLAG_META[key].description}
            </Text>
          </div>
          <Switch
            checked={flags[key]}
            disabled={saving === key}
            onCheckedChange={(v) => toggle(key, !!v)}
          />
        </div>
      ))}
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

export default FeatureTogglesWidget
