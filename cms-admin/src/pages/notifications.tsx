import { Outlet, useNavigate, useLocation } from "react-router-dom"
import { Menu, Card, Empty, Typography } from "antd"
import { MailOutlined, MessageOutlined, WhatsAppOutlined } from "@ant-design/icons"
import type { ReactNode } from "react"

const { Title, Text } = Typography

// ── Layout: left sub-navigation + routed content ─────────────────────────────
export const Notifications = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const menuItems = [
    {
      key: "email",
      icon: <MailOutlined />,
      label: "Email",
      children: [
        { key: "/notifications/email/settings", label: "Settings" },
        { key: "/notifications/email/templates", label: "Templates" },
      ],
    },
    { key: "/notifications/text", icon: <MessageOutlined />, label: "Text" },
    { key: "/notifications/whatsapp", icon: <WhatsAppOutlined />, label: "WhatsApp" },
  ]

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>Notifications</Title>
        <Text type="secondary">Outbound messaging — email, text, and WhatsApp.</Text>
      </div>

      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ width: 200, flexShrink: 0 }}>
          <Menu
            mode="inline"
            selectedKeys={[pathname]}
            defaultOpenKeys={["email"]}
            items={menuItems}
            onClick={({ key }) => {
              if (key.startsWith("/")) navigate(key)
            }}
            style={{ border: "none", background: "transparent" }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}

// ── "Coming soon" placeholders ───────────────────────────────────────────────
function ComingSoon({ icon, channel }: { icon: ReactNode; channel: string }) {
  return (
    <Card>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
            <Title level={5} style={{ margin: 0 }}>{channel} notifications</Title>
            <Text type="secondary">Coming soon.</Text>
          </div>
        }
      />
    </Card>
  )
}

export const NotificationsText = () => (
  <ComingSoon icon={<MessageOutlined />} channel="Text (SMS)" />
)

export const NotificationsWhatsapp = () => (
  <ComingSoon icon={<WhatsAppOutlined />} channel="WhatsApp" />
)
