import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Envelope } from "@medusajs/icons"
import {
  Container,
  Heading,
  Button,
  Input,
  Textarea,
  Select,
  Badge,
  Text,
  toast,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

type Campaign = {
  id: string
  name: string
  subject: string
  body_html: string
  audience_type: "subscribers" | "segment" | "all_customers" | "everyone"
  audience_segment: string | null
  status: "draft" | "sending" | "sent" | "failed"
  total_recipients: number
  sent_count: number
  failed_count: number
  last_error: string | null
  created_at: string
}

type Editor = {
  id?: string
  name: string
  subject: string
  body_html: string
  audience_type: Campaign["audience_type"]
  audience_segment: string
}

const EMPTY: Editor = {
  name: "",
  subject: "",
  body_html: "",
  audience_type: "subscribers",
  audience_segment: "new",
}

const AUDIENCE_LABEL: Record<string, string> = {
  subscribers: "Newsletter subscribers",
  segment: "Customer segment",
  all_customers: "All customers",
  everyone: "Everyone",
}

const statusColor = (s: string): "grey" | "orange" | "green" | "red" =>
  s === "sent" ? "green" : s === "sending" ? "orange" : s === "failed" ? "red" : "grey"

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

const CampaignsPage = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    api("/admin/marketing/campaigns")
      .then((d) => setCampaigns(d.campaigns || []))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const save = async () => {
    if (!editor) return
    setBusy(true)
    try {
      const path = editor.id ? `/admin/marketing/campaigns/${editor.id}` : "/admin/marketing/campaigns"
      await api(path, "POST", {
        name: editor.name,
        subject: editor.subject,
        body_html: editor.body_html,
        audience_type: editor.audience_type,
        audience_segment: editor.audience_type === "segment" ? editor.audience_segment : null,
      })
      toast.success(editor.id ? "Campaign saved." : "Draft created.")
      setEditor(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const send = async (c: Campaign) => {
    if (!window.confirm(`Send "${c.name}" now to its full audience? This can't be undone.`)) return
    setBusy(true)
    try {
      await api(`/admin/marketing/campaigns/${c.id}/send`, "POST")
      toast.success("Sending started — refresh to watch progress.")
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const test = async (c: Campaign) => {
    const email = window.prompt("Send a test of this campaign to which email?")
    if (!email) return
    setBusy(true)
    try {
      await api(`/admin/marketing/campaigns/${c.id}/test`, "POST", { email })
      toast.success(`Test sent to ${email}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const del = async (c: Campaign) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return
    setBusy(true)
    try {
      await api(`/admin/marketing/campaigns/${c.id}`, "DELETE")
      toast.success("Deleted.")
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 }
  const card: React.CSSProperties = {
    padding: 16,
    borderRadius: 12,
    border: "1px solid var(--border-base)",
    background: "var(--bg-base)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  }

  return (
    <Container>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Heading level="h1">Email Campaigns</Heading>
            <Text size="small" style={{ color: "var(--fg-subtle)", marginTop: 4 }}>
              Compose and send marketing emails to subscribers and customers.
            </Text>
          </div>
          {!editor && (
            <Button onClick={() => setEditor({ ...EMPTY })}>New campaign</Button>
          )}
        </div>

        {/* Editor */}
        {editor && (
          <div style={{ ...card, gap: 12 }}>
            <Heading level="h2">{editor.id ? "Edit campaign" : "New campaign"}</Heading>
            <div style={field}>
              <Text size="small" weight="plus">Name (internal)</Text>
              <Input value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} placeholder="Diwali sale blast" />
            </div>
            <div style={field}>
              <Text size="small" weight="plus">Subject line</Text>
              <Input value={editor.subject} onChange={(e) => setEditor({ ...editor, subject: e.target.value })} placeholder="✨ Up to 30% off this Diwali" />
            </div>
            <div style={field}>
              <Text size="small" weight="plus">Body (HTML)</Text>
              <Textarea rows={8} value={editor.body_html} onChange={(e) => setEditor({ ...editor, body_html: e.target.value })} placeholder="<h2>Diwali Collection</h2><p>...</p>" />
              <Text size="xsmall" style={{ color: "var(--fg-subtle)" }}>
                The brand header and a legal unsubscribe footer are added automatically.
              </Text>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ ...field, flex: 1 }}>
                <Text size="small" weight="plus">Audience</Text>
                <Select value={editor.audience_type} onValueChange={(v) => setEditor({ ...editor, audience_type: v as any })}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    {Object.entries(AUDIENCE_LABEL).map(([v, l]) => (
                      <Select.Item key={v} value={v}>{l}</Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              {editor.audience_type === "segment" && (
                <div style={{ ...field, flex: 1 }}>
                  <Text size="small" weight="plus">Segment</Text>
                  <Select value={editor.audience_segment} onValueChange={(v) => setEditor({ ...editor, audience_segment: v })}>
                    <Select.Trigger><Select.Value /></Select.Trigger>
                    <Select.Content>
                      <Select.Item value="new">New</Select.Item>
                      <Select.Item value="repeat">Repeat</Select.Item>
                      <Select.Item value="regular">Regular</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={save} disabled={busy} isLoading={busy}>Save draft</Button>
              <Button variant="secondary" onClick={() => setEditor(null)} disabled={busy}>Cancel</Button>
            </div>
          </div>
        )}

        {loading && <Text size="small">Loading…</Text>}
        {!loading && !campaigns.length && !editor && (
          <Text size="small" style={{ color: "var(--fg-subtle)" }}>No campaigns yet.</Text>
        )}

        {/* List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {campaigns.map((c) => (
            <div key={c.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Text weight="plus">{c.name}</Text>
                    <Badge color={statusColor(c.status)} size="2xsmall">{c.status}</Badge>
                  </div>
                  <Text size="small" style={{ color: "var(--fg-subtle)", marginTop: 2 }}>
                    {c.subject} · {AUDIENCE_LABEL[c.audience_type]}{c.audience_segment ? ` (${c.audience_segment})` : ""}
                  </Text>
                  {(c.status === "sending" || c.status === "sent") && (
                    <Text size="xsmall" style={{ color: "var(--fg-subtle)", marginTop: 2 }}>
                      {c.sent_count} sent · {c.failed_count} failed · {c.total_recipients} total
                      {c.last_error ? ` · ${c.last_error}` : ""}
                    </Text>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <Button size="small" variant="secondary" onClick={() => test(c)} disabled={busy}>Test</Button>
                  {(c.status === "draft" || c.status === "failed") && (
                    <>
                      <Button size="small" variant="secondary" onClick={() => setEditor({ id: c.id, name: c.name, subject: c.subject, body_html: c.body_html, audience_type: c.audience_type, audience_segment: c.audience_segment || "new" })} disabled={busy}>Edit</Button>
                      <Button size="small" onClick={() => send(c)} disabled={busy}>Send</Button>
                      <Button size="small" variant="danger" onClick={() => del(c)} disabled={busy}>Delete</Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Email Campaigns",
  icon: Envelope,
})

export default CampaignsPage
