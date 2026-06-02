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
  Switch,
  Divider,
  Descriptions,
  Tag,
  Space,
  Checkbox,
} from "antd"
import { SaveOutlined, EditOutlined, CloseOutlined } from "@ant-design/icons"
import { useState } from "react"
import { Link } from "react-router-dom"

const { Title, Text } = Typography

const DEFAULTS = {
  announcement_enabled: true,
  announcement_text: "",
  show_topbar_contact: true,
  show_topbar_email: true,
  show_topbar_phone: true,
}

const CONTACT_OPTIONS = [
  { label: "Email", value: "email" },
  { label: "Phone", value: "phone" },
]

function SectionTitle({ index, title, tag }: { index: number; title: string; tag?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "24px 0 12px" }}>
      <Title level={5} style={{ margin: 0 }}>
        {index}. {title}
      </Title>
      {tag}
    </div>
  )
}

// Sections 2 & 3 have no settings yet — shown as required/informational in both modes.
function BrandingInfo() {
  return (
    <Descriptions column={1} bordered size="middle" labelStyle={{ width: 220 }}>
      <Descriptions.Item label="Contains">
        Logo, search, and account / wishlist / cart icons
      </Descriptions.Item>
      <Descriptions.Item label="Visibility">
        <Tag color="blue">Always visible</Tag>
      </Descriptions.Item>
    </Descriptions>
  )
}

function NavInfo() {
  return (
    <Descriptions column={1} bordered size="middle" labelStyle={{ width: 220 }}>
      <Descriptions.Item label="Contains">
        Category links from your store catalog
      </Descriptions.Item>
      <Descriptions.Item label="Visibility">
        <Tag color="blue">Always visible</Tag>
      </Descriptions.Item>
    </Descriptions>
  )
}

function QuickLinksNote() {
  return (
    <Alert
      type="info"
      showIcon
      message="Top-bar quick links"
      description={
        <>The “About / Contact” links in the top bar come from a menu. Manage them under{" "}
        <Link to="/menus">Menus</Link> → location <b>Header — Quick Links</b>. Contact email &amp; phone live under <Link to="/settings">Store Info</Link>.</>
      }
    />
  )
}

function HeaderForm() {
  const { data, isLoading, isError, refetch } = useList({
    resource: "cms_header_settings",
    pagination: { pageSize: 1 },
    queryOptions: { retry: false },
  })
  const { mutate: updateOne, isLoading: isSaving } = useUpdate()
  const { mutate: createOne } = useCreate()
  const [form] = Form.useForm()
  const [editing, setEditing] = useState(false)
  const announcementOn = Form.useWatch("announcement_enabled", form)
  const contactOn = Form.useWatch("show_topbar_contact", form)

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
    const seed = { ...DEFAULTS, ...(record || {}) }
    const contact_channels = [
      ...(seed.show_topbar_email ? ["email"] : []),
      ...(seed.show_topbar_phone ? ["phone"] : []),
    ]
    form.setFieldsValue({ ...seed, contact_channels })
    setEditing(true)
  }
  const cancelEdit = () => {
    form.resetFields()
    setEditing(false)
  }

  const handleSave = (values: any) => {
    const channels: string[] = values.contact_channels || []
    const contactOnVal = !!values.show_topbar_contact
    const payload = {
      announcement_enabled: values.announcement_enabled,
      // When the bar is off, clear the text so re-enabling forces fresh copy.
      announcement_text: values.announcement_enabled ? values.announcement_text : null,
      show_topbar_contact: contactOnVal,
      // When contact is off, reset channels so re-enabling forces a fresh pick.
      show_topbar_email: contactOnVal && channels.includes("email"),
      show_topbar_phone: contactOnVal && channels.includes("phone"),
    }
    const onSuccess = () => {
      message.success("Header settings saved")
      setEditing(false)
      refetch()
    }
    if (record) {
      updateOne(
        { resource: "cms_header_settings", id: record.id, values: payload },
        { onSuccess, onError: () => message.error("Failed to save") }
      )
    } else {
      createOne(
        { resource: "cms_header_settings", values: payload },
        { onSuccess, onError: () => message.error("Failed to create") }
      )
    }
  }

  // ── Read-only view ──
  if (!editing) {
    const enabled = record?.announcement_enabled ?? true
    const showContact = record?.show_topbar_contact ?? true
    const showEmail = record?.show_topbar_email ?? true
    const showPhone = record?.show_topbar_phone ?? true
    return (
      <>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button type="primary" icon={<EditOutlined />} onClick={startEdit}>
            Edit
          </Button>
        </div>

        {/* 1. Announcement Bar — optional */}
        <SectionTitle
          index={1}
          title="Announcement Bar"
          tag={enabled ? <Tag color="green">On</Tag> : <Tag>Off</Tag>}
        />
        <Descriptions column={1} bordered size="middle" labelStyle={{ width: 220 }}>
          <Descriptions.Item label="Message">
            {enabled ? (
              record?.announcement_text || <Text type="secondary">On — no text set</Text>
            ) : (
              <Text type="secondary">Bar is hidden on the storefront</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Contact Info in Top Bar">
            {showContact ? (
              <Space size={4}>
                {showEmail && <Tag color="green">Email</Tag>}
                {showPhone && <Tag color="green">Phone</Tag>}
                {!showEmail && !showPhone && <Tag>On — no channel</Tag>}
              </Space>
            ) : (
              <Tag>Hidden</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>

        {/* 2. Branding & Search Bar — required */}
        <SectionTitle index={2} title="Branding & Search Bar" tag={<Tag color="blue">Required</Tag>} />
        <BrandingInfo />

        {/* 3. Navigation Bar — required */}
        <SectionTitle index={3} title="Navigation Bar" tag={<Tag color="blue">Required</Tag>} />
        <NavInfo />

        <Divider />
        <QuickLinksNote />
      </>
    )
  }

  // ── Edit mode ──
  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSave}
      initialValues={{ ...DEFAULTS, ...(record || {}) }}
    >
      {/* 1. Announcement Bar — editable */}
      <SectionTitle index={1} title="Announcement Bar" />
      <div
        style={{
          padding: 20,
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10,
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {/* Primary setting: announcement on/off + text */}
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          <Form.Item
            label="Show Announcement Bar"
            name="announcement_enabled"
            valuePropName="checked"
            extra="Turn the bar on or off."
            style={{ flex: "0 0 180px", marginBottom: 0 }}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="Announcement Bar Text"
            name="announcement_text"
            dependencies={["announcement_enabled"]}
            rules={[
              {
                required: !!announcementOn,
                whitespace: true,
                message: "Add announcement text, or turn the bar off",
              },
              { max: 160, message: "Keep it under 160 characters" },
            ]}
            extra={
              announcementOn
                ? "Required while the announcement bar is on."
                : "The bar is off — this text won't show until you turn it on."
            }
            style={{ flex: 1, marginBottom: 0 }}
          >
            <Input.TextArea rows={2} disabled={!announcementOn} />
          </Form.Item>
        </div>

        {/* Sub-setting: contact info — nested under the announcement bar */}
        <div
          style={{
            marginTop: 20,
            marginLeft: 8,
            paddingLeft: 16,
            borderLeft: "2px solid rgba(77,182,172,0.45)",
          }}
        >
          <Text
            type="secondary"
            style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}
          >
            Sub-setting
          </Text>
          <Form.Item
            label="Show Contact Info in Top Bar"
            name="show_topbar_contact"
            valuePropName="checked"
            extra="Shows contact info (from Store Info) on the left of the top bar, on desktop."
            style={{ marginTop: 8, marginBottom: contactOn ? 12 : 0 }}
          >
            <Switch size="small" />
          </Form.Item>

          {contactOn && (
            <Form.Item
              label="Which contact to show"
              name="contact_channels"
              rules={[{ required: true, message: "Select email and/or phone" }]}
              extra="Pick at least one."
              style={{ marginBottom: 0 }}
            >
              <Checkbox.Group options={CONTACT_OPTIONS} />
            </Form.Item>
          )}
        </div>
      </div>

      {/* 2. Branding & Search Bar — required, not editable */}
      <SectionTitle index={2} title="Branding & Search Bar" tag={<Tag color="blue">Required</Tag>} />
      <BrandingInfo />

      {/* 3. Navigation Bar — required, not editable */}
      <SectionTitle index={3} title="Navigation Bar" tag={<Tag color="blue">Required</Tag>} />
      <NavInfo />

      <Space style={{ marginTop: 24 }}>
        <Button type="primary" htmlType="submit" loading={isSaving} icon={<SaveOutlined />}>
          Save
        </Button>
        <Button icon={<CloseOutlined />} onClick={cancelEdit} disabled={isSaving}>
          Cancel
        </Button>
      </Space>

      <Divider />
      <QuickLinksNote />
    </Form>
  )
}

export const Header = () => (
  <div>
    <div style={{ marginBottom: 24 }}>
      <Title level={3} style={{ margin: 0 }}>Header</Title>
      <Text type="secondary">Announcement bar and top-bar options for the storefront header.</Text>
    </div>
    <Card>
      <HeaderForm />
    </Card>
  </div>
)
