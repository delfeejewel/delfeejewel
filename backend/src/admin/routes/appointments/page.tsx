import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Calendar } from "@medusajs/icons"
import {
  Container,
  Heading,
  Text,
  Button,
  Badge,
  Table,
  Input,
  Label,
  Switch,
  toast,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

type Appointment = {
  id: string
  reference: string
  name: string
  email: string
  phone: string
  service_type: string
  date: string
  slot: string
  status: "confirmed" | "completed" | "cancelled"
  notes: string | null
}

type Settings = {
  slot_minutes: number
  capacity_per_slot: number
  weekdays: number[]
  open_time: string
  close_time: string
  lead_hours: number
  horizon_days: number
  closed_dates: string[]
  enabled: boolean
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const statusColor = (s: string) =>
  s === "confirmed" ? "blue" : s === "completed" ? "green" : "red"

const AppointmentsPage = () => {
  const [rows, setRows] = useState<Appointment[]>([])
  const [totals, setTotals] = useState<any>({})
  const [view, setView] = useState<"upcoming" | "all" | "confirmed" | "completed" | "cancelled">("upcoming")
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  const load = () => {
    setLoading(true)
    const qs =
      view === "all" ? "?scope=all" : view === "upcoming" ? "?scope=upcoming" : `?status=${view}&scope=all`
    fetch(`/admin/appointments${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setRows(d.appointments || [])
        setTotals(d.totals || {})
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [view])

  useEffect(() => {
    fetch("/admin/appointments/settings", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSettings(d.settings))
      .catch(() => {})
  }, [])

  const act = async (id: string, status: string) => {
    let cancelled_reason: string | undefined
    if (status === "cancelled") {
      cancelled_reason = window.prompt("Reason for cancelling (optional):") || undefined
    }
    const res = await fetch(`/admin/appointments/${id}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, cancelled_reason }),
    })
    if (res.ok) {
      toast.success(`Marked ${status}.`)
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d?.message || "Could not update.")
    }
  }

  const saveSettings = async () => {
    if (!settings) return
    setSavingSettings(true)
    try {
      const res = await fetch("/admin/appointments/settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.message || "Save failed")
      setSettings(d.settings)
      toast.success("Availability saved.")
    } catch (e: any) {
      toast.error(e?.message || "Save failed")
    } finally {
      setSavingSettings(false)
    }
  }

  const toggleDay = (d: number) => {
    if (!settings) return
    const has = settings.weekdays.includes(d)
    setSettings({
      ...settings,
      weekdays: has ? settings.weekdays.filter((x) => x !== d) : [...settings.weekdays, d].sort(),
    })
  }

  return (
    <Container>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <Heading level="h1">Appointments</Heading>
            <Text size="small" style={{ color: "var(--fg-subtle)", marginTop: 4 }}>
              {totals.upcoming ?? 0} upcoming · {totals.completed ?? 0} completed · {totals.cancelled ?? 0} cancelled
            </Text>
          </div>
          <Button variant="secondary" size="small" onClick={() => setShowSettings((v) => !v)}>
            {showSettings ? "Hide availability" : "Availability settings"}
          </Button>
        </div>

        {/* Availability settings */}
        {showSettings && settings && (
          <div style={{ border: "1px solid var(--border-base)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Switch checked={settings.enabled} onCheckedChange={(v) => setSettings({ ...settings, enabled: v })} />
              <Label>Bookings {settings.enabled ? "open" : "closed"}</Label>
            </div>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div>
                <Label size="small">Open time</Label>
                <Input value={settings.open_time} onChange={(e) => setSettings({ ...settings, open_time: e.target.value })} style={{ width: 110 }} />
              </div>
              <div>
                <Label size="small">Close time</Label>
                <Input value={settings.close_time} onChange={(e) => setSettings({ ...settings, close_time: e.target.value })} style={{ width: 110 }} />
              </div>
              <div>
                <Label size="small">Slot length (min)</Label>
                <Input type="number" value={settings.slot_minutes} onChange={(e) => setSettings({ ...settings, slot_minutes: Number(e.target.value) })} style={{ width: 110 }} />
              </div>
              <div>
                <Label size="small">Capacity / slot</Label>
                <Input type="number" value={settings.capacity_per_slot} onChange={(e) => setSettings({ ...settings, capacity_per_slot: Number(e.target.value) })} style={{ width: 110 }} />
              </div>
              <div>
                <Label size="small">Min notice (hrs)</Label>
                <Input type="number" value={settings.lead_hours} onChange={(e) => setSettings({ ...settings, lead_hours: Number(e.target.value) })} style={{ width: 110 }} />
              </div>
              <div>
                <Label size="small">Bookable ahead (days)</Label>
                <Input type="number" value={settings.horizon_days} onChange={(e) => setSettings({ ...settings, horizon_days: Number(e.target.value) })} style={{ width: 130 }} />
              </div>
            </div>

            <div>
              <Label size="small">Open days</Label>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {DOW.map((d, i) => (
                  <Button key={i} size="small" variant={settings.weekdays.includes(i) ? "primary" : "secondary"} onClick={() => toggleDay(i)}>
                    {d}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label size="small">Closed dates (comma-separated YYYY-MM-DD)</Label>
              <Input
                value={(settings.closed_dates || []).join(", ")}
                onChange={(e) =>
                  setSettings({ ...settings, closed_dates: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
                }
                placeholder="2026-07-04, 2026-08-15"
              />
            </div>

            <div>
              <Button onClick={saveSettings} isLoading={savingSettings}>Save availability</Button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["upcoming", "all", "confirmed", "completed", "cancelled"] as const).map((v) => (
            <Button key={v} size="small" variant={view === v ? "primary" : "secondary"} onClick={() => setView(v)}>
              {v[0].toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </div>

        {loading && <Text size="small">Loading…</Text>}
        {!loading && rows.length === 0 && <Text size="small" style={{ color: "var(--fg-subtle)" }}>No appointments.</Text>}

        {!loading && rows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Date</Table.HeaderCell>
                  <Table.HeaderCell>Time</Table.HeaderCell>
                  <Table.HeaderCell>Customer</Table.HeaderCell>
                  <Table.HeaderCell>For</Table.HeaderCell>
                  <Table.HeaderCell>Ref</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell> </Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((a) => (
                  <Table.Row key={a.id}>
                    <Table.Cell>{a.date}</Table.Cell>
                    <Table.Cell>{a.slot}</Table.Cell>
                    <Table.Cell>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <Text size="small">{a.name}</Text>
                        <Text size="xsmall" style={{ color: "var(--fg-subtle)" }}>{a.phone} · {a.email}</Text>
                        {a.notes && <Text size="xsmall" style={{ color: "var(--fg-subtle)" }}>“{a.notes}”</Text>}
                      </div>
                    </Table.Cell>
                    <Table.Cell>{a.service_type}</Table.Cell>
                    <Table.Cell><Text size="xsmall">{a.reference}</Text></Table.Cell>
                    <Table.Cell><Badge color={statusColor(a.status)}>{a.status}</Badge></Table.Cell>
                    <Table.Cell>
                      {a.status === "confirmed" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <Button size="small" variant="secondary" onClick={() => act(a.id, "completed")}>Done</Button>
                          <Button size="small" variant="danger" onClick={() => act(a.id, "cancelled")}>Cancel</Button>
                        </div>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Appointments",
  icon: Calendar,
})

export default AppointmentsPage
