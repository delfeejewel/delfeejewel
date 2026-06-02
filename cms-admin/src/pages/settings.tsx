import { useList, useUpdate, useCreate } from "@refinedev/core"
import { Typography, Card, Form, Input, Button, Spin, message, Divider, Alert, Checkbox, Select } from "antd"
import { SaveOutlined, PhoneOutlined, EnvironmentOutlined, LinkOutlined, ClockCircleOutlined, FileTextOutlined } from "@ant-design/icons"
import { useState, useEffect } from "react"

const { Title, Text } = Typography

// ─── Hours Editor ────────────────────────────────────
const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
]

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const h = i + 1
  return [
    { value: `${h}:00`, label: `${h}:00` },
    { value: `${h}:30`, label: `${h}:30` },
  ]
}).flat()

const PERIOD_OPTIONS = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
]

// Convert 12h (e.g. "10:00", "AM") to 24h storage format "10:00"
function to24h(time: string, period: string): string {
  if (!time || !period) return ""
  const [h, m] = time.split(":").map(Number)
  let hr = h
  if (period === "AM" && h === 12) hr = 0
  else if (period === "PM" && h !== 12) hr += 12
  return `${String(hr).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

// Convert 24h storage "14:00" to { time: "2:00", period: "PM" }
function from24h(val: string): { time: string; period: string } {
  if (!val) return { time: "", period: "AM" }
  const [h, m] = val.split(":").map(Number)
  const period = h < 12 ? "AM" : "PM"
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h
  return { time: `${hr}:${String(m).padStart(2, "0")}`, period }
}

const DEFAULT_HOURS: Record<string, { open: boolean; start: string; end: string }> = {
  mon: { open: true, start: "10:00", end: "20:00" },
  tue: { open: true, start: "10:00", end: "20:00" },
  wed: { open: true, start: "10:00", end: "20:00" },
  thu: { open: true, start: "10:00", end: "20:00" },
  fri: { open: true, start: "10:00", end: "20:00" },
  sat: { open: true, start: "10:00", end: "20:00" },
  sun: { open: false, start: "", end: "" },
}

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman & Nicobar Islands", "Chandigarh", "Dadra & Nagar Haveli and Daman & Diu",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
].map((s) => ({ value: s, label: s }))

function TimePicker({ value, disabled, onChange }: { value?: string; disabled?: boolean; onChange?: (v: string) => void }) {
  const { time, period } = from24h(value || "")

  const handleChange = (newTime?: string, newPeriod?: string) => {
    const t = newTime ?? time
    const p = newPeriod ?? period
    if (t && p) onChange?.(to24h(t, p))
  }

  return (
    <div style={{ display: "flex", gap: 4 }}>
      <Select
        size="small"
        value={!disabled && time ? time : undefined}
        placeholder="—"
        disabled={disabled}
        options={HOUR_OPTIONS}
        onChange={(v) => handleChange(v, undefined)}
        style={{ flex: 1 }}
        popupMatchSelectWidth={false}
      />
      <Select
        size="small"
        value={!disabled && period ? period : undefined}
        placeholder="—"
        disabled={disabled}
        options={PERIOD_OPTIONS}
        onChange={(v) => handleChange(undefined, v)}
        style={{ width: 70 }}
      />
    </div>
  )
}

function HoursEditor({ value, onChange }: { value?: any; onChange?: (v: any) => void }) {
  const hours = { ...DEFAULT_HOURS, ...(typeof value === "object" && value ? value : {}) }

  const update = (day: string, field: string, val: any) => {
    const updated = { ...hours, [day]: { ...hours[day], [field]: val } }
    onChange?.(updated)
  }

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "130px 50px 1fr 24px 1fr",
          gap: 8,
          padding: "8px 12px",
          background: "rgba(255,255,255,0.03)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          fontSize: 11,
          color: "rgba(255,255,255,0.4)",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        <span>Day</span>
        <span>Open</span>
        <span>Opens at</span>
        <span />
        <span>Closes at</span>
      </div>

      {DAYS.map((day) => {
        const h = hours[day.key] || { open: false, start: "", end: "" }
        return (
          <div
            key={day.key}
            style={{
              display: "grid",
              gridTemplateColumns: "130px 50px 1fr 24px 1fr",
              gap: 8,
              alignItems: "center",
              padding: "6px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              opacity: h.open ? 1 : 0.45,
              transition: "opacity 0.2s",
            }}
          >
            <Text style={{ fontSize: 13 }}>{day.label}</Text>
            <Checkbox
              checked={h.open}
              onChange={(e) => update(day.key, "open", e.target.checked)}
            />
            <TimePicker
              value={h.start}
              disabled={!h.open}
              onChange={(v) => update(day.key, "start", v)}
            />
            <Text type="secondary" style={{ textAlign: "center", fontSize: 12 }}>to</Text>
            <TimePicker
              value={h.end}
              disabled={!h.open}
              onChange={(v) => update(day.key, "end", v)}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Store Info Form ─────────────────────────────────
function StoreInfoForm() {
  const { data, isLoading, isError, refetch } = useList({
    resource: "cms_store_info",
    pagination: { pageSize: 1 },
    queryOptions: { retry: false },
  })

  const { mutate: updateOne, isLoading: isSaving } = useUpdate()
  const { mutate: createOne } = useCreate()
  const [form] = Form.useForm()
  const [initialized, setInitialized] = useState(false)

  const record = data?.data?.[0] as any

  useEffect(() => {
    if (record && !initialized) {
      const values = { ...record }
      // Parse hours JSON string from DB if needed
      if (typeof values.hours === "string") {
        try { values.hours = JSON.parse(values.hours) } catch { values.hours = DEFAULT_HOURS }
      }
      form.setFieldsValue(values)
      setInitialized(true)
    }
  }, [record, form, initialized])

  if (isLoading) return <Spin tip="Loading..."><div style={{ minHeight: 200 }} /></Spin>

  if (isError) {
    return (
      <Alert
        message="Table not found"
        description={<>Run <code>cms-admin/supabase/create-store-info.sql</code> in Supabase SQL Editor to create the store info table.</>}
        type="warning"
        showIcon
      />
    )
  }

  const handleSave = (values: any) => {
    // Stringify hours for DB storage
    const payload = {
      ...values,
      hours: typeof values.hours === "object" ? JSON.stringify(values.hours) : values.hours,
    }

    if (record) {
      updateOne(
        { resource: "cms_store_info", id: record.id, values: payload },
        {
          onSuccess: () => {
            message.success("Store info saved")
            refetch()
          },
          onError: () => message.error("Failed to save"),
        }
      )
    } else {
      createOne(
        { resource: "cms_store_info", values: payload },
        {
          onSuccess: () => {
            message.success("Store info created")
            refetch()
          },
          onError: () => message.error("Failed to create"),
        }
      )
    }
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSave}
      initialValues={record || { store_name: "Delfee", hours: DEFAULT_HOURS }}
    >
      {/* Location */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <EnvironmentOutlined style={{ fontSize: 16, color: "#4db6ac" }} />
        <Title level={5} style={{ margin: 0 }}>Location</Title>
      </div>

      <Form.Item label="Store Name" name="store_name" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
        <Input placeholder="Aurum Boutique" />
      </Form.Item>

      <Form.Item label="Address" name="address" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
        <Input.TextArea rows={2} placeholder="123 Jewellery Lane, MG Road" />
      </Form.Item>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Form.Item label="City" name="city" style={{ marginBottom: 12 }}>
          <Input placeholder="Mumbai" />
        </Form.Item>
        <Form.Item label="State / UT" name="state" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
          <Select
            showSearch
            placeholder="Select state"
            optionFilterProp="label"
            options={INDIAN_STATES}
          />
        </Form.Item>
        <Form.Item label="Pincode" name="pincode" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
          <Input placeholder="400001" />
        </Form.Item>
      </div>

      <Form.Item
        label="Google Maps Link"
        name="map_url"
        rules={[{ required: true }]}
        style={{ marginBottom: 12 }}
        extra="Paste the Google Maps share link — used for the 'Get Directions' button"
      >
        <Input placeholder="https://maps.app.goo.gl/..." />
      </Form.Item>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Form.Item
          label="Latitude"
          name="latitude"
          rules={[{ required: true }]}
          style={{ marginBottom: 12 }}
          extra="Right-click your location on Google Maps → copy coordinates"
        >
          <Input placeholder="e.g. 30.707381" />
        </Form.Item>
        <Form.Item
          label="Longitude"
          name="longitude"
          rules={[{ required: true }]}
          style={{ marginBottom: 12 }}
        >
          <Input placeholder="e.g. 76.764799" />
        </Form.Item>
      </div>

      <Divider style={{ margin: "20px 0" }} />

      {/* Hours */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <ClockCircleOutlined style={{ fontSize: 16, color: "#4db6ac" }} />
        <Title level={5} style={{ margin: 0 }}>Business Hours</Title>
      </div>

      <Form.Item name="hours" rules={[{ required: true, message: "Business hours are required" }]} style={{ marginBottom: 12 }}>
        <HoursEditor />
      </Form.Item>

      <Divider style={{ margin: "20px 0" }} />

      {/* Contact */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <PhoneOutlined style={{ fontSize: 16, color: "#4db6ac" }} />
        <Title level={5} style={{ margin: 0 }}>Contact</Title>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Form.Item
          label="Phone"
          name="phone"
          rules={[
            { required: true, message: "Phone is required" },
            { pattern: /^[+]?[\d][\d\s-]{7,14}$/, message: "Enter a valid phone number" },
          ]}
          style={{ marginBottom: 12 }}
        >
          <Input placeholder="+91 98765 43210" />
        </Form.Item>
        <Form.Item
          label="WhatsApp"
          name="whatsapp"
          rules={[{ pattern: /^[+]?[\d][\d\s-]{7,14}$/, message: "Enter a valid phone number" }]}
          style={{ marginBottom: 12 }}
        >
          <Input placeholder="+91 98765 43210" />
        </Form.Item>
        <Form.Item
          label="Email"
          name="email"
          rules={[{ required: true, type: "email", message: "Enter a valid email" }]}
          style={{ marginBottom: 12 }}
        >
          <Input placeholder="hello@aurum.com" />
        </Form.Item>
      </div>

      <Divider style={{ margin: "20px 0" }} />

      {/* Social */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <LinkOutlined style={{ fontSize: 16, color: "#4db6ac" }} />
        <Title level={5} style={{ margin: 0 }}>Social Media</Title>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Form.Item
          label="Instagram"
          name="instagram"
          rules={[{ type: "url", message: "Enter a valid URL (https://…)" }]}
          style={{ marginBottom: 12 }}
        >
          <Input placeholder="https://instagram.com/aurum" />
        </Form.Item>
        <Form.Item
          label="Facebook"
          name="facebook"
          rules={[{ type: "url", message: "Enter a valid URL (https://…)" }]}
          style={{ marginBottom: 12 }}
        >
          <Input placeholder="https://facebook.com/aurum" />
        </Form.Item>
        <Form.Item
          label="YouTube"
          name="youtube"
          rules={[{ type: "url", message: "Enter a valid URL (https://…)" }]}
          style={{ marginBottom: 12 }}
        >
          <Input placeholder="https://youtube.com/@aurum" />
        </Form.Item>
        <Form.Item
          label="Pinterest"
          name="pinterest"
          rules={[{ type: "url", message: "Enter a valid URL (https://…)" }]}
          style={{ marginBottom: 12 }}
        >
          <Input placeholder="https://pinterest.com/aurum" />
        </Form.Item>
      </div>

      <Divider style={{ margin: "20px 0" }} />

      {/* GST & Invoice */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <FileTextOutlined style={{ fontSize: 16, color: "#4db6ac" }} />
        <Title level={5} style={{ margin: 0 }}>GST & Invoice</Title>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Form.Item label="GSTIN" name="gstin" rules={[{ required: true, message: "GSTIN is required for invoices" }]} style={{ marginBottom: 12 }}>
          <Input placeholder="06AABCU9603R1ZM" />
        </Form.Item>
        <Form.Item label="PAN" name="pan" style={{ marginBottom: 12 }}>
          <Input placeholder="AABCU9603R" />
        </Form.Item>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Form.Item label="Default GST Rate (%)" name="gst_rate" rules={[{ required: true }]} style={{ marginBottom: 12 }}
          extra="3% for jewellery (HSN 7117)"
        >
          <Input type="number" placeholder="3" />
        </Form.Item>
        <Form.Item label="Default HSN Code" name="hsn_code" rules={[{ required: true }]} style={{ marginBottom: 12 }}
          extra="7117 = Imitation jewellery"
        >
          <Input placeholder="7117" />
        </Form.Item>
      </div>

      <div style={{ marginTop: 20 }}>
        <Button
          type="primary"
          htmlType="submit"
          loading={isSaving}
          icon={<SaveOutlined />}
          size="large"
        >
          Save Store Info
        </Button>
      </div>
    </Form>
  )
}

export const Settings = () => {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Store Info</Title>
        <Text type="secondary">Contact details used across the storefront — footer, Find a Store section, contact page, and emails.</Text>
      </div>

      <Card>
        <StoreInfoForm />
      </Card>
    </div>
  )
}
