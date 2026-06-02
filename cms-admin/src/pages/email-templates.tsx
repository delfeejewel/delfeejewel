import { useList, useUpdate } from "@refinedev/core"
import {
  Typography, Card, Table, Tag, Switch, Button, Drawer, Form, Input,
  Spin, Alert, message, Space, Tooltip,
} from "antd"
import { EditOutlined, SaveOutlined } from "@ant-design/icons"
import { useState, useEffect } from "react"

const { Title, Text, Paragraph } = Typography

const CATEGORY_COLORS: Record<string, string> = {
  order: "blue",
  return: "orange",
  exchange: "purple",
  gift_card: "magenta",
  inventory: "gold",
  marketing: "green",
}

type TemplateRow = {
  id: string
  template_key: string
  label: string
  description?: string
  category: string
  subject: string
  body_html: string
  variables: string[]
  enabled: boolean
}

function TemplateEditor({
  record,
  onClose,
  onSaved,
}: {
  record: TemplateRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const { mutate: updateOne, isLoading: isSaving } = useUpdate()
  const [form] = Form.useForm()

  useEffect(() => {
    if (record) form.setFieldsValue(record)
  }, [record, form])

  if (!record) return null

  const variables: string[] = Array.isArray(record.variables) ? record.variables : []

  const copyVar = async (name: string) => {
    const token = `{{${name}}}`
    try {
      await navigator.clipboard.writeText(token)
      message.success(`Copied ${token}`)
    } catch {
      message.info(`Use ${token}`)
    }
  }

  const handleSave = (values: any) => {
    updateOne(
      {
        resource: "cms_email_templates",
        id: record.id,
        values: {
          subject: values.subject,
          body_html: values.body_html,
          enabled: !!values.enabled,
        },
      },
      {
        onSuccess: () => {
          message.success("Template saved")
          onSaved()
          onClose()
        },
        onError: () => message.error("Failed to save template"),
      }
    )
  }

  return (
    <Drawer
      title={
        <Space>
          {record.label}
          <Tag color={CATEGORY_COLORS[record.category] || "default"}>{record.category}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }} copyable>{record.template_key}</Text>
        </Space>
      }
      width={640}
      open={!!record}
      onClose={onClose}
      extra={
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={isSaving}
          onClick={() => form.submit()}
        >
          Save
        </Button>
      }
    >
      {record.description && (
        <Paragraph type="secondary" style={{ marginTop: -8 }}>{record.description}</Paragraph>
      )}

      <Form form={form} layout="vertical" onFinish={handleSave} initialValues={record}>
        <Form.Item label="Enabled" name="enabled" valuePropName="checked" extra="Turn this email on or off">
          <Switch />
        </Form.Item>

        <Form.Item
          label="Subject"
          name="subject"
          rules={[{ required: true, message: "Subject is required" }]}
        >
          <Input placeholder="Order Confirmed — #{{order_number}}" />
        </Form.Item>

        <Form.Item label="Available variables" extra="Click a variable to copy it, then paste it into the subject or body.">
          <Space wrap size={[4, 8]}>
            {variables.length === 0 && <Text type="secondary">None</Text>}
            {variables.map((v) => (
              <Tooltip key={v} title="Copy">
                <Tag
                  onClick={() => copyVar(v)}
                  style={{ cursor: "pointer", fontFamily: "monospace" }}
                >
                  {`{{${v}}}`}
                </Tag>
              </Tooltip>
            ))}
          </Space>
        </Form.Item>

        <Form.Item
          label="Body (HTML)"
          name="body_html"
          rules={[{ required: true, message: "Body is required" }]}
        >
          <Input.TextArea
            rows={14}
            style={{ fontFamily: "monospace", fontSize: 13 }}
            placeholder="<p>Hi {{customer_name}}, ...</p>"
          />
        </Form.Item>
      </Form>
    </Drawer>
  )
}

export const EmailTemplates = () => {
  const { data, isLoading, isError, refetch } = useList<TemplateRow>({
    resource: "cms_email_templates",
    sorters: [{ field: "sort_order", order: "asc" }],
    pagination: { pageSize: 100 },
    queryOptions: { retry: false },
  })
  const { mutate: updateOne } = useUpdate()
  const [editing, setEditing] = useState<TemplateRow | null>(null)

  const toggleEnabled = (row: TemplateRow, enabled: boolean) => {
    updateOne(
      { resource: "cms_email_templates", id: row.id, values: { enabled } },
      {
        onSuccess: () => { message.success(`${row.label} ${enabled ? "enabled" : "disabled"}`); refetch() },
        onError: () => message.error("Failed to update"),
      }
    )
  }

  if (isLoading) return <Spin tip="Loading templates..."><div style={{ minHeight: 200 }} /></Spin>

  if (isError) {
    return (
      <Alert
        message="Table not found"
        description={<>Run <code>cms-admin/supabase/create-email-templates.sql</code> in the Supabase SQL Editor to create the templates table.</>}
        type="warning"
        showIcon
      />
    )
  }

  const rows = data?.data || []

  const columns = [
    {
      title: "Email",
      dataIndex: "label",
      render: (label: string, row: TemplateRow) => (
        <div>
          <Text strong>{label}</Text>
          {row.description && (
            <div><Text type="secondary" style={{ fontSize: 12 }}>{row.description}</Text></div>
          )}
        </div>
      ),
    },
    {
      title: "Category",
      dataIndex: "category",
      width: 120,
      render: (c: string) => <Tag color={CATEGORY_COLORS[c] || "default"}>{c}</Tag>,
    },
    {
      title: "Subject",
      dataIndex: "subject",
      render: (s: string) => <Text style={{ fontSize: 13 }}>{s}</Text>,
    },
    {
      title: "Enabled",
      dataIndex: "enabled",
      width: 90,
      render: (enabled: boolean, row: TemplateRow) => (
        <Switch checked={enabled} size="small" onChange={(v) => toggleEnabled(row, v)} />
      ),
    },
    {
      title: "",
      width: 80,
      render: (_: any, row: TemplateRow) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(row)}>Edit</Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Templates</Title>
        <Text type="secondary">
          Subject and body for each outbound email. Use {"{{variable}}"} placeholders.
        </Text>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Drafts"
        description="Edits are saved here as drafts. The store still uses the built-in templates until these are wired up."
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          dataSource={rows}
          columns={columns as any}
          pagination={false}
          size="middle"
        />
      </Card>

      <TemplateEditor record={editing} onClose={() => setEditing(null)} onSaved={refetch} />
    </div>
  )
}
