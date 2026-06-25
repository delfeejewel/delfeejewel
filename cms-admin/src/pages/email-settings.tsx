import { useList, useUpdate, useCreate, useDelete } from "@refinedev/core"
import {
  Typography, Card, Form, Input, InputNumber, Button, Spin, message,
  Divider, Alert, Select, Checkbox, Popconfirm, Space, Tag,
} from "antd"
import { SaveOutlined, DeleteOutlined, SendOutlined, EditOutlined, CloseOutlined, LockOutlined } from "@ant-design/icons"
import { useState, useEffect } from "react"
import { useIsDeveloper } from "../hooks/use-role"
import { supabaseClient } from "../providers/supabase"

const { Title, Text } = Typography

const PROVIDER_OPTIONS = [
  { value: "resend", label: "Resend (recommended)" },
  { value: "gmail", label: "Gmail" },
  { value: "smtp", label: "SMTP" },
]

// GoDaddy-hosted email is plain SMTP — these quick-fill the host/port/TLS for
// the two GoDaddy mail products. The login is the full email address + mailbox
// password, entered in the username/password fields below.
const SMTP_PRESETS = [
  { label: "GoDaddy · Microsoft 365", smtp_host: "smtp.office365.com", smtp_port: 587, smtp_secure: false },
  { label: "GoDaddy · Professional Email", smtp_host: "smtpout.secureserver.net", smtp_port: 465, smtp_secure: true },
]

function EmailSettingsForm({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading, isError, refetch } = useList({
    resource: "cms_email_sender",
    pagination: { pageSize: 1 },
    queryOptions: { retry: false },
  })

  const { mutate: updateOne, isLoading: isSaving } = useUpdate()
  const { mutate: createOne, isLoading: isCreating } = useCreate()
  const { mutate: deleteOne, isLoading: isDeleting } = useDelete()
  const [form] = Form.useForm()
  const [initialized, setInitialized] = useState(false)
  const [editing, setEditing] = useState(false)

  const provider = Form.useWatch("provider", form) || "resend"
  const record = data?.data?.[0] as any

  useEffect(() => {
    if (isLoading || initialized) return
    if (record) {
      form.setFieldsValue(record)
      setEditing(false) // existing sender → start read-only
    } else {
      setEditing(canEdit) // no sender yet → editable only for developers
    }
    setInitialized(true)
  }, [record, isLoading, initialized, canEdit, form])

  if (isLoading) return <Spin tip="Loading..."><div style={{ minHeight: 200 }} /></Spin>

  if (isError) {
    return (
      <Alert
        message="Table not found"
        description={<>Run <code>cms-admin/supabase/create-email-sender.sql</code> in the Supabase SQL Editor to create the email sender table.</>}
        type="warning"
        showIcon
      />
    )
  }

  if (!record && !canEdit) {
    return (
      <Alert
        type="info"
        showIcon
        icon={<LockOutlined />}
        message="No email sender configured"
        description="A developer needs to set up the outbound email sender. Until then, the store sends no email."
      />
    )
  }

  const handleSave = (values: any) => {
    // Only persist the credentials relevant to the chosen provider, so a
    // half-filled "other" provider's secrets never linger in the row.
    const base = {
      from_name: values.from_name || null,
      from_email: values.from_email,
      // Every branch clears the other providers' secrets so a half-filled
      // "other" provider's credentials never linger in the row.
      resend_api_key: null as string | null,
      gmail_user: null as string | null,
      gmail_app_password: null as string | null,
      smtp_host: null as string | null,
      smtp_port: null as number | null,
      smtp_user: null as string | null,
      smtp_pass: null as string | null,
      smtp_secure: false,
    }

    const payload =
      values.provider === "resend"
        ? { ...base, provider: "resend", resend_api_key: values.resend_api_key }
        : values.provider === "gmail"
        ? {
            ...base,
            provider: "gmail",
            gmail_user: values.gmail_user,
            gmail_app_password: values.gmail_app_password,
          }
        : {
            ...base,
            provider: "smtp",
            smtp_host: values.smtp_host,
            smtp_port: values.smtp_port,
            smtp_user: values.smtp_user,
            smtp_pass: values.smtp_pass,
            smtp_secure: !!values.smtp_secure,
          }

    if (record) {
      updateOne(
        { resource: "cms_email_sender", id: record.id, values: payload },
        {
          onSuccess: () => { message.success("Email sender saved"); setEditing(false); refetch() },
          onError: () => message.error("Failed to save"),
        }
      )
    } else {
      createOne(
        { resource: "cms_email_sender", values: payload },
        {
          onSuccess: () => { message.success("Email sender saved"); setEditing(false); refetch() },
          onError: () => message.error("Failed to save"),
        }
      )
    }
  }

  const handleCancel = () => {
    if (record) {
      form.setFieldsValue(record) // discard edits, restore saved values
      setEditing(false)
    } else {
      form.resetFields()
    }
  }

  const handleDelete = () => {
    if (!record) return
    deleteOne(
      { resource: "cms_email_sender", id: record.id },
      {
        onSuccess: () => {
          message.success("Email sender removed — outbound email is now disabled")
          form.resetFields()
          setEditing(true) // back to a blank, editable form
          refetch()
        },
        onError: () => message.error("Failed to remove"),
      }
    )
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSave}
      disabled={!editing}
      initialValues={record || { provider: "resend", smtp_port: 587, smtp_secure: false }}
    >
      {/* Action bar — developers only. Admins always see a read-only view. */}
      {canEdit && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
          {editing ? (
            <>
              <Button icon={<CloseOutlined />} onClick={handleCancel} disabled={false}>
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={isSaving || isCreating}
                disabled={false}
              >
                Save
              </Button>
            </>
          ) : (
            <>
              <Button icon={<EditOutlined />} onClick={() => setEditing(true)} disabled={false}>
                Edit
              </Button>
              {record && (
                <Popconfirm
                  title="Remove email sender?"
                  description="Outbound email will be disabled until a sender is configured again."
                  okText="Remove"
                  okButtonProps={{ danger: true }}
                  onConfirm={handleDelete}
                >
                  <Button danger icon={<DeleteOutlined />} loading={isDeleting} disabled={false}>
                    Remove
                  </Button>
                </Popconfirm>
              )}
            </>
          )}
        </div>
      )}

      <Form.Item
        label="Provider"
        name="provider"
        rules={[{ required: true }]}
        style={{ maxWidth: 240 }}
      >
        <Select options={PROVIDER_OPTIONS} />
      </Form.Item>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Form.Item
          label="From Name"
          name="from_name"
          extra="Shown as the sender name, e.g. “Delfee”"
        >
          <Input placeholder="Delfee" />
        </Form.Item>
        <Form.Item
          label="From Email"
          name="from_email"
          rules={[{ required: true, type: "email", message: "Enter a valid sender email" }]}
        >
          <Input placeholder="orders@yourstore.com" />
        </Form.Item>
      </div>

      <Divider style={{ margin: "8px 0 20px" }} />

      {provider === "resend" && (
        <>
          {editing && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="Resend sends over HTTPS"
              description={
                <>
                  Works on hosts that block SMTP. Create an API key at{" "}
                  <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer">
                    resend.com/api-keys
                  </a>{" "}
                  and verify your sending domain at{" "}
                  <a href="https://resend.com/domains" target="_blank" rel="noreferrer">
                    resend.com/domains
                  </a>
                  . The <b>From Email</b> above must use that verified domain.
                </>
              }
            />
          )}
          <Form.Item
            label="Resend API Key"
            name="resend_api_key"
            rules={[{ required: true, message: "Required" }]}
            extra="Starts with re_ — created in the Resend dashboard"
            style={{ maxWidth: 480 }}
          >
            <Input.Password placeholder="re_xxxxxxxxxxxxxxxxxxxx" autoComplete="new-password" />
          </Form.Item>
        </>
      )}

      {provider === "gmail" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Form.Item
            label="Gmail Address"
            name="gmail_user"
            rules={[{ required: true, type: "email", message: "Enter the Gmail account address" }]}
          >
            <Input placeholder="account@gmail.com" autoComplete="off" />
          </Form.Item>
          <Form.Item
            label="Gmail App Password"
            name="gmail_app_password"
            rules={[{ required: true, message: "Required" }]}
            extra="A 16-character Google App Password (not your login password)"
          >
            <Input.Password placeholder="xxxx xxxx xxxx xxxx" autoComplete="new-password" />
          </Form.Item>
        </div>
      )}

      {provider === "smtp" && (
        <>
          {editing && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>Quick fill:</Text>
            <Space size={4} wrap>
              {SMTP_PRESETS.map((p) => (
                <Tag.CheckableTag
                  key={p.label}
                  checked={false}
                  onChange={() => {
                    form.setFieldsValue({
                      smtp_host: p.smtp_host,
                      smtp_port: p.smtp_port,
                      smtp_secure: p.smtp_secure,
                    })
                    message.info(`${p.label} server settings filled — enter your email login below`)
                  }}
                  style={{ border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }}
                >
                  {p.label}
                </Tag.CheckableTag>
              ))}
            </Space>
          </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
            <Form.Item
              label="SMTP Host"
              name="smtp_host"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input placeholder="smtp.example.com" />
            </Form.Item>
            <Form.Item
              label="Port"
              name="smtp_port"
              rules={[{ required: true, message: "Required" }]}
            >
              <InputNumber style={{ width: "100%" }} placeholder="587" min={1} max={65535} />
            </Form.Item>
            <Form.Item
              label="Secure (TLS)"
              name="smtp_secure"
              valuePropName="checked"
              extra="On for port 465"
            >
              <Checkbox>Use TLS</Checkbox>
            </Form.Item>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item
              label="SMTP Username"
              name="smtp_user"
              rules={[{ required: true, message: "Required" }]}
              extra="For GoDaddy, this is your full email address"
            >
              <Input placeholder="you@yourdomain.com" autoComplete="off" />
            </Form.Item>
            <Form.Item
              label="SMTP Password"
              name="smtp_pass"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input.Password placeholder="••••••••" autoComplete="new-password" />
            </Form.Item>
          </div>
        </>
      )}
    </Form>
  )
}

function TestEmailCard() {
  const [to, setTo] = useState("")
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim())) {
      message.error("Enter a valid recipient email")
      return
    }
    setSending(true)
    try {
      const { data } = await supabaseClient.auth.getSession()
      const token = data?.session?.access_token
      const url = import.meta.env.VITE_MEDUSA_BACKEND_URL || "http://localhost:9000"
      const res = await fetch(`${url}/store/email-test`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-publishable-api-key": import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY || "",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ to: to.trim() }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        message.success(body.message || `Test email sent to ${to.trim()}`)
      } else {
        message.error(body.message || "Failed to send test email")
      }
    } catch (e: any) {
      message.error(e?.message || "Could not reach the backend")
    } finally {
      setSending(false)
    }
  }

  return (
    <Card style={{ marginTop: 16 }}>
      <Title level={5} style={{ marginTop: 0 }}>Send a test email</Title>
      <Text type="secondary">
        Save the sender first, then send a test to confirm it works. Uses the currently saved sender.
      </Text>
      <Space.Compact style={{ display: "flex", marginTop: 12, maxWidth: 480 }}>
        <Input
          type="email"
          placeholder="recipient@example.com"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          onPressEnter={send}
        />
        <Button type="primary" icon={<SendOutlined />} loading={sending} onClick={send}>
          Send Test
        </Button>
      </Space.Compact>
    </Card>
  )
}

export const EmailSettings = () => {
  const isDeveloper = useIsDeveloper()

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Settings</Title>
        <Text type="secondary">
          The account used to send all outbound store emails.
          {isDeveloper ? "" : " (Read-only — only developers can change these.)"}
        </Text>
      </div>

      {isDeveloper && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="No sender = no email"
          description="If no sender is saved here (or it is removed), the store will not send any outbound email."
        />
      )}

      <Card>
        <EmailSettingsForm canEdit={isDeveloper} />
      </Card>

      {/* Test send hits a developer-gated backend route, so only show it to developers. */}
      {isDeveloper && <TestEmailCard />}
    </div>
  )
}
