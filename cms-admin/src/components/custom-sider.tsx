import { useLogout, useMenu } from "@refinedev/core"
import { ThemedTitleV2 } from "@refinedev/antd"
import { Link, useLocation } from "react-router-dom"
import { Menu, Button } from "antd"
import { LogoutOutlined } from "@ant-design/icons"

export const CustomSider = () => {
  const { menuItems } = useMenu()
  const { mutate: logout } = useLogout()
  const { pathname } = useLocation()

  const items = menuItems.map((item: any) => {
    const route = item.route || item.list || `/${item.key}`
    return {
      key: route,
      label: <Link to={route}>{item.label}</Link>,
      icon: item.icon,
    }
  })

  return (
    <div
      style={{
        width: 240,
        height: "100vh",
        position: "sticky",
        top: 0,
        display: "flex",
        flexDirection: "column",
        background: "#141414",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Logo */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <ThemedTitleV2 text="Store CMS" collapsed={false} />
      </div>

      {/* Menu */}
      <div style={{ flex: 1, overflow: "auto", paddingTop: 8 }}>
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          style={{ border: "none", background: "transparent" }}
          items={items}
        />
      </div>

      {/* Logout — pinned at bottom */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <Button
          type="text"
          icon={<LogoutOutlined />}
          onClick={() => logout()}
          block
          style={{
            textAlign: "left",
            justifyContent: "flex-start",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          Logout
        </Button>
      </div>
    </div>
  )
}
