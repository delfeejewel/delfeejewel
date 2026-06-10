import { useList, useUpdate, useCreate, useDelete, useInvalidate } from "@refinedev/core"
import {
  Typography,
  Card,
  Form,
  Input,
  Button,
  Spin,
  message,
  Divider,
  Alert,
  Space,
  Tag,
  Drawer,
  Segmented,
  Empty,
  Popconfirm,
} from "antd"
import {
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  InboxOutlined,
  FormOutlined,
  MailOutlined,
} from "@ant-design/icons"
import { Outlet, useNavigate, useLocation } from "react-router-dom"
import { useState, useEffect } from "react"

const { Title, Text, Paragraph } = Typography

// ── Layout: left sub-navigation + routed content ─────────────────────────────
export const Forms = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const menuItems = [
    { key: "/forms/contact", icon: <FormOutlined />, label: "Contact Form" },
    { key: "/forms/submissions", icon: <InboxOutlined />, label: "Submissions" },
  ]

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>Forms</Title>
        <Text type="secondary">Storefront forms — edit the fields and read what visitors send in.</Text>
      </div>

      <div style={{ marginBottom: 20 }}>
        <Segmented
          value={menuItems.find((m) => pathname.startsWith(m.key))?.key || "/forms/contact"}
          onChange={(v) => navigate(v as string)}
          options={menuItems.map((m) => ({ value: m.key, label: <span>{m.icon} {m.label}</span> }))}
        />
      </div>

      <Outlet />
    </div>
  )
}

// ── Contact form config editor (singleton) ───────────────────────────────────
const TableMissing = () => (
  <Alert
    message="Tables not found"
    description={<>Run <code>cms-admin/supabase/create-contact-form.sql</code> in the Supabase SQL Editor to create the contact form tables.</>}
    type="warning"
    showIcon
  />
)

export const ContactFormSettings = () => {
  const { data, isLoading, isError, refetch } = useList({
    resource: "cms_contact_form",
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
      const subjects = Array.isArray(record.subjects)
        ? record.subjects
        : (() => {
            try { return JSON.parse(record.subjects) } catch { return [] }
          })()
      form.setFieldsValue({
        ...record,
        subjects: (subjects as string[]).map((s) => ({ value: s })),
      })
      setInitialized(true)
    }
  }, [record, form, initialized])

  if (isLoading) return <Spin tip="Loading..."><div style={{ minHeight: 200 }} /></Spin>
  if (isError) return <TableMissing />

  const handleSave = (values: any) => {
    const payload = {
      ...values,
      subjects: (values.subjects || [])
        .map((s: any) => (s?.value || "").trim())
        .filter(Boolean),
    }

    const onDone = (verb: string) => ({
      onSuccess: () => { message.success(`Contact form ${verb}`); refetch() },
      onError: () => message.error("Failed to save"),
    })

    if (record) {
      updateOne({ resource: "cms_contact_form", id: record.id, values: payload }, onDone("saved"))
    } else {
      createOne({ resource: "cms_contact_form", values: payload }, onDone("created"))
    }
  }

  const cardFields = (name: string, withHref: boolean) => (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Form.Item label="Title" name={[name, "title"]} style={{ marginBottom: 12 }}>
          <Input />
        </Form.Item>
        <Form.Item label="Highlighted text" name={[name, "text"]} style={{ marginBottom: 12 }}>
          <Input />
        </Form.Item>
      </div>
      <Form.Item label="Sub-text" name={[name, "sub"]} style={{ marginBottom: 12 }}>
        <Input />
      </Form.Item>
      {withHref && (
        <Form.Item label="Link (optional)" name={[name, "href"]} style={{ marginBottom: 0 }}
          extra="e.g. a WhatsApp wa.me link, or mailto:">
          <Input placeholder="https://wa.me/91…" />
        </Form.Item>
      )}
    </>
  )

  return (
    <Card>
      <Form form={form} layout="vertical" onFinish={handleSave}>
        {/* Heading */}
        <Title level={5} style={{ marginTop: 0 }}>Heading</Title>
        <Form.Item label="Section heading" name="heading" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
          <Input placeholder="Send us a message" />
        </Form.Item>
        <Form.Item label="Sub-heading" name="subheading" style={{ marginBottom: 12 }}>
          <Input.TextArea rows={2} placeholder="Fill in the form and we'll get back to you as soon as we can." />
        </Form.Item>

        <Divider />

        {/* Subject options */}
        <Title level={5}>Subject options</Title>
        <Text type="secondary">The choices in the "Subject" dropdown. Drag-free ordering = top to bottom.</Text>
        <Form.List name="subjects">
          {(fields, { add, remove }) => (
            <div style={{ marginTop: 12 }}>
              {fields.map((field) => (
                <Space key={field.key} style={{ display: "flex", marginBottom: 8 }} align="baseline">
                  <Form.Item
                    {...field}
                    name={[field.name, "value"]}
                    rules={[{ required: true, message: "Enter a subject or remove this row" }]}
                    style={{ marginBottom: 0, width: 420 }}
                  >
                    <Input placeholder="e.g. Order Support" />
                  </Form.Item>
                  <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                </Space>
              ))}
              <Button type="dashed" onClick={() => add({ value: "" })} icon={<PlusOutlined />}>
                Add subject
              </Button>
            </div>
          )}
        </Form.List>

        <Divider />

        {/* Submit + success */}
        <Title level={5}>Submit & confirmation</Title>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Form.Item label="Button label" name="submit_label" style={{ marginBottom: 12 }}>
            <Input placeholder="Send Message" />
          </Form.Item>
          <Form.Item label="Success title" name="success_title" style={{ marginBottom: 12 }}>
            <Input placeholder="Message Sent" />
          </Form.Item>
        </div>
        <Form.Item label="Success message" name="success_message" style={{ marginBottom: 12 }}>
          <Input.TextArea rows={2} placeholder="Thank you for reaching out…" />
        </Form.Item>

        <Divider />

        {/* Notification recipient */}
        <Title level={5}>Notifications</Title>
        <Form.Item
          label="Notify this email on new messages"
          name="notify_email"
          rules={[{ type: "email", message: "Enter a valid email" }]}
          style={{ marginBottom: 12 }}
          extra="Leave blank to use the backend's default support inbox."
        >
          <Input prefix={<MailOutlined />} placeholder="enquire@delfee.in" />
        </Form.Item>

        <Divider />

        {/* Side panel cards */}
        <Title level={5}>Side-panel cards</Title>
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          The three contact cards shown next to the form.
        </Paragraph>

        <Title level={5} style={{ fontSize: 14 }}>Email card</Title>
        {cardFields("email_card", true)}
        <Divider dashed />
        <Title level={5} style={{ fontSize: 14 }}>WhatsApp card</Title>
        {cardFields("whatsapp_card", true)}
        <Divider dashed />
        <Title level={5} style={{ fontSize: 14 }}>Support hours card</Title>
        {cardFields("hours_card", false)}

        <div style={{ marginTop: 24 }}>
          <Button type="primary" htmlType="submit" loading={isSaving} icon={<SaveOutlined />} size="large">
            Save Contact Form
          </Button>
        </div>
      </Form>
    </Card>
  )
}

// ── Submissions inbox ─────────────────────────────────────────────────────────
type Submission = {
  id: string
  name: string
  email: string
  phone: string | null
  subject: string | null
  message: string
  status: "new" | "read" | "archived"
  created_at: string
}

const STATUS_TAG: Record<string, string> = { new: "gold", read: "green", archived: "default" }

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })

export const ContactSubmissions = () => {
  const [filter, setFilter] = useState<"all" | "new" | "read" | "archived">("all")
  const [selected, setSelected] = useState<Submission | null>(null)

  const { data, isLoading, isError } = useList<Submission>({
    resource: "contact_submissions",
    pagination: { pageSize: 200 },
    sorters: [{ field: "created_at", order: "desc" }],
    filters: filter === "all" ? [] : [{ field: "status", operator: "eq", value: filter }],
    queryOptions: { retry: false },
  })

  const { mutate: updateOne } = useUpdate()
  const { mutate: removeOne } = useDelete()
  const invalidate = useInvalidate()

  const refreshList = () =>
    invalidate({ resource: "contact_submissions", invalidates: ["list"] })

  const setStatus = (row: Submission, status: Submission["status"]) => {
    updateOne(
      { resource: "contact_submissions", id: row.id, values: { status } },
      {
        onSuccess: () => {
          message.success(`Marked as ${status}`)
          if (selected?.id === row.id) setSelected({ ...selected, status })
          refreshList()
        },
        onError: () => message.error("Failed to update"),
      }
    )
  }

  const remove = (row: Submission) => {
    removeOne(
      { resource: "contact_submissions", id: row.id },
      {
        onSuccess: () => {
          message.success("Message deleted")
          if (selected?.id === row.id) setSelected(null)
          refreshList()
        },
        onError: () => message.error("Failed to delete"),
      }
    )
  }

  const open = (row: Submission) => {
    setSelected(row)
    if (row.status === "new") setStatus(row, "read")
  }

  if (isError) return <TableMissing />

  const rows = data?.data || []

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Segmented
          value={filter}
          onChange={(v) => setFilter(v as any)}
          options={[
            { value: "all", label: "All" },
            { value: "new", label: "New" },
            { value: "read", label: "Read" },
            { value: "archived", label: "Archived" },
          ]}
        />
        <Text type="secondary">{rows.length} message{rows.length === 1 ? "" : "s"}</Text>
      </div>

      {isLoading ? (
        <Spin tip="Loading..."><div style={{ minHeight: 160 }} /></Spin>
      ) : rows.length === 0 ? (
        <Empty description="No messages here yet." image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((row) => (
            <div
              key={row.id}
              onClick={() => open(row)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
                background: row.status === "new" ? "rgba(212,175,55,0.06)" : "transparent",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Text strong style={{ fontWeight: row.status === "new" ? 700 : 500 }}>{row.name}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{row.email}</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 13, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {row.subject ? `${row.subject} — ` : ""}{row.message}
                </Text>
              </div>
              <Tag color={STATUS_TAG[row.status]}>{row.status}</Tag>
              <Text type="secondary" style={{ fontSize: 12, width: 130, textAlign: "right" }}>{fmtDate(row.created_at)}</Text>
            </div>
          ))}
        </div>
      )}

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        width={460}
        title={selected?.subject || "Message"}
        extra={selected && <Tag color={STATUS_TAG[selected.status]}>{selected.status}</Tag>}
      >
        {selected && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Received</Text>
              <div>{fmtDate(selected.created_at)}</div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>From</Text>
              <div>{selected.name}</div>
              <a href={`mailto:${selected.email}`}>{selected.email}</a>
              {selected.phone && <div><a href={`tel:${selected.phone}`}>{selected.phone}</a></div>}
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Message</Text>
              <Paragraph style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{selected.message}</Paragraph>
            </div>

            <Divider style={{ margin: "4px 0" }} />

            <Space wrap>
              <Button type="primary" icon={<MailOutlined />} href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject || "Your message")}`}>
                Reply
              </Button>
              {selected.status !== "archived" ? (
                <Button onClick={() => setStatus(selected, "archived")}>Archive</Button>
              ) : (
                <Button onClick={() => setStatus(selected, "read")}>Unarchive</Button>
              )}
              <Popconfirm title="Delete this message?" onConfirm={() => remove(selected)} okText="Delete" okButtonProps={{ danger: true }}>
                <Button danger icon={<DeleteOutlined />}>Delete</Button>
              </Popconfirm>
            </Space>
          </div>
        )}
      </Drawer>
    </Card>
  )
}
