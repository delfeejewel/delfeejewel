import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Badge, Text, Select, Button } from "@medusajs/ui"
import { useEffect, useState } from "react"

type Role = "developer" | "admin" | "ops" | "marketing" | "viewer"

const ROLE_LABEL: Record<Role, string> = {
  developer: "Developer",
  admin: "Admin",
  ops: "Operations",
  marketing: "Marketing",
  viewer: "Viewer (read-only)",
}

const ROLE_COLOR: Record<Role, "red" | "blue" | "green" | "purple" | "grey"> = {
  developer: "red",
  admin: "blue",
  ops: "green",
  marketing: "purple",
  viewer: "grey",
}

const UserRoleWidget = ({ data }: { data: { id: string; email?: string } }) => {
  const [role, setRole] = useState<Role | null>(null)
  const [draft, setDraft] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    fetch(`/admin/set-role`, { credentials: "include" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
        const me = (body.users || []).find((u: any) => u.id === data.id)
        const current = (me?.role || "admin") as Role
        setRole(current)
        setDraft(current)
      })
      .catch((e) => setError(e?.message || "Failed to load role"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [data.id])

  const save = async () => {
    if (!draft || draft === role) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const r = await fetch(`/admin/set-role`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: data.id, role: draft }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
      setRole(draft)
      setSuccess(`Role updated to ${ROLE_LABEL[draft]}`)
    } catch (e: any) {
      setError(e?.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <Heading level="h2">Role</Heading>
        {loading && <Text size="small">Loading…</Text>}
        {error && (
          <Text size="small" style={{ color: "#b91c1c" }}>
            {error}
          </Text>
        )}
        {role && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Badge color={ROLE_COLOR[role]}>{ROLE_LABEL[role]}</Badge>
              <Text size="xsmall" style={{ color: "#9ca3af" }}>
                Current role
              </Text>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <Select
                value={draft || role}
                onValueChange={(v) => setDraft(v as Role)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                    <Select.Item key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
              <Button
                size="small"
                disabled={saving || draft === role}
                onClick={save}
              >
                {saving ? "Saving…" : "Update"}
              </Button>
            </div>
            {success && (
              <Text size="small" style={{ color: "#15803d" }}>
                {success}
              </Text>
            )}
            <Text size="xsmall" style={{ color: "#9ca3af" }}>
              Only developers can change roles. Permissions are coarse — see
              the codebase&apos;s lib/rbac.ts for the full matrix.
            </Text>
          </>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "user.details.side.before",
})

export default UserRoleWidget
