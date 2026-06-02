import { useList, useUpdate, useCreate } from "@refinedev/core"
import {
  Typography,
  Card,
  Form,
  Input,
  Button,
  Spin,
  message,
  Alert,
  Divider,
  Descriptions,
  Space,
} from "antd"
import { SaveOutlined, EditOutlined, CloseOutlined } from "@ant-design/icons"
import { useState } from "react"
import { Link } from "react-router-dom"

const { Title, Text } = Typography

function ColumnsNote() {
  return (
    <Alert
      type="info"
      showIcon
      message="Footer link columns"
      description={
        <>The three footer link columns come from menus. Manage them under{" "}
        <Link to="/menus">Menus</Link> → locations <b>Footer — Column 1/2/3</b>. Contact details &amp; social links live under <Link to="/settings">Store Info</Link>.</>
      }
    />
  )
}

function FooterForm() {
  const { data, isLoading, isError, refetch } = useList({
    resource: "cms_footer_settings",
    pagination: { pageSize: 1 },
    queryOptions: { retry: false },
  })
  const { mutate: updateOne, isLoading: isSaving } = useUpdate()
  const { mutate: createOne } = useCreate()
  const [form] = Form.useForm()
  const [editing, setEditing] = useState(false)

  const record = data?.data?.[0] as any

  if (isLoading) return <Spin tip="Loading..."><div style={{ minHeight: 160 }} /></Spin>

  if (isError) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Table not found"
        description={<>Run <code>cms-admin/supabase/create-header-footer-menus.sql</code> in the Supabase SQL Editor.</>}
      />
    )
  }

  const startEdit = () => {
    form.setFieldsValue(record || {})
    setEditing(true)
  }
  const cancelEdit = () => {
    form.resetFields()
    setEditing(false)
  }

  const handleSave = (values: any) => {
    const onSuccess = () => {
      message.success("Footer settings saved")
      setEditing(false)
      refetch()
    }
    if (record) {
      updateOne(
        { resource: "cms_footer_settings", id: record.id, values },
        { onSuccess, onError: () => message.error("Failed to save") }
      )
    } else {
      createOne(
        { resource: "cms_footer_settings", values },
        { onSuccess, onError: () => message.error("Failed to create") }
      )
    }
  }

  // ── Read-only view ──
  if (!editing) {
    return (
      <>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <Button type="primary" icon={<EditOutlined />} onClick={startEdit}>
            Edit
          </Button>
        </div>
        <Descriptions column={1} bordered size="middle" labelStyle={{ width: 220 }}>
          <Descriptions.Item label="Newsletter Heading">
            {record?.newsletter_heading || <Text type="secondary">— not set —</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Brand Tagline">
            {record?.tagline || <Text type="secondary">— not set —</Text>}
          </Descriptions.Item>
        </Descriptions>
        <Divider />
        <ColumnsNote />
      </>
    )
  }

  // ── Edit mode ──
  return (
    <Form form={form} layout="vertical" onFinish={handleSave} initialValues={record || {}}>
      <Form.Item
        label="Newsletter Heading"
        name="newsletter_heading"
        rules={[{ max: 60, message: "Keep it short (under 60 characters)" }]}
        extra="The label above the newsletter signup box."
      >
        <Input placeholder="Stay in the loop" />
      </Form.Item>

      <Form.Item
        label="Brand Tagline"
        name="tagline"
        rules={[{ max: 80, message: "Keep it under 80 characters" }]}
        extra="Short line shown under the logo in the footer."
      >
        <Input placeholder="Handcrafted Fine Jewellery" />
      </Form.Item>

      <Space style={{ marginTop: 8 }}>
        <Button type="primary" htmlType="submit" loading={isSaving} icon={<SaveOutlined />}>
          Save
        </Button>
        <Button icon={<CloseOutlined />} onClick={cancelEdit} disabled={isSaving}>
          Cancel
        </Button>
      </Space>

      <Divider />
      <ColumnsNote />
    </Form>
  )
}

export const Footer = () => (
  <div>
    <div style={{ marginBottom: 24 }}>
      <Title level={3} style={{ margin: 0 }}>Footer</Title>
      <Text type="secondary">Newsletter heading and tagline for the storefront footer.</Text>
    </div>
    <Card>
      <FooterForm />
    </Card>
  </div>
)
