import { useTable, EditButton, DeleteButton, CreateButton } from "@refinedev/antd"
import { useList, useUpdate, useCreate, useDelete } from "@refinedev/core"
import {
  Table, Switch, Space, Card, Typography, Spin, Select,
  Divider, Tooltip, Button, Input, Form, message, Tag, Alert, Empty, Menu,
} from "antd"
import {
  DeleteOutlined, HolderOutlined, CheckCircleOutlined,
  CloseCircleOutlined, SaveOutlined, InfoCircleOutlined,
  PictureOutlined, TagsOutlined, StarOutlined, ThunderboltOutlined, SettingOutlined,
  AppstoreOutlined, PlusOutlined,
} from "@ant-design/icons"
import { ImageUpload } from "../components/image-upload"
import { Outlet, useNavigate, useLocation } from "react-router-dom"
import { useState, useCallback, useEffect } from "react"
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import React from "react"

const { Title, Text } = Typography

// ─── Section Toggles ─────────────────────────────────
const SectionToggles = () => {
  const { data, isLoading, refetch } = useList({
    resource: "cms_homepage_settings",
    sorters: [{ field: "sort_order", order: "asc" }],
    pagination: { pageSize: 20 },
  })

  const { mutate, isLoading: isMutating } = useUpdate()

  const handleToggle = (id: string, label: string, checked: boolean) => {
    mutate(
      { resource: "cms_homepage_settings", id, values: { is_visible: checked } },
      {
        onSuccess: () => {
          message.success(`${label} ${checked ? "enabled" : "disabled"}`)
          refetch()
        },
        onError: () => message.error("Failed to update visibility"),
      }
    )
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <Spin tip="Loading sections..."><div style={{ minHeight: 100 }} /></Spin>
      </div>
    )
  }

  const sections = data?.data || []

  if (!sections.length) {
    return (
      <Alert
        message="No sections configured"
        description="Run the homepage settings SQL seed in Supabase to set up section toggles."
        type="warning"
        showIcon
      />
    )
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Title level={5} style={{ margin: 0 }}>Section Visibility</Title>
        <Tag color="blue" style={{ fontSize: 11 }}>{sections.filter((s: any) => s.is_visible).length}/{sections.length} active</Tag>
      </div>
      <Text type="secondary" style={{ display: "block", marginBottom: 16, fontSize: 13 }}>
        Control which sections appear on your homepage. Some sections are always visible.
      </Text>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
        {sections.map((section: any) => (
          <div
            key={section.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              borderRadius: 8,
              border: section.is_visible ? "1px solid rgba(77,182,172,0.3)" : "1px solid rgba(255,255,255,0.08)",
              background: section.is_visible ? "rgba(77,182,172,0.04)" : "transparent",
              opacity: section.is_visible ? 1 : 0.5,
              transition: "all 0.25s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {section.is_visible
                ? <CheckCircleOutlined style={{ color: "#4db6ac", fontSize: 14 }} />
                : <CloseCircleOutlined style={{ color: "#666", fontSize: 14 }} />
              }
              <div>
                <Text strong style={{ fontSize: 13 }}>{section.section_label}</Text>
                {!section.can_toggle && (
                  <Text type="secondary" style={{ display: "block", fontSize: 10, lineHeight: 1.2 }}>Required</Text>
                )}
              </div>
            </div>
            <Switch
              checked={section.is_visible}
              disabled={!section.can_toggle || isMutating}
              onChange={(checked) => handleToggle(section.id, section.section_label, checked)}
              size="small"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Sortable Row ────────────────────────────────────
function SortableRow(props: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props["data-row-key"],
  })

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: isDragging ? "rgba(77,182,172,0.06)" : undefined,
    cursor: "default",
  }

  return <tr {...props} ref={setNodeRef} style={style} {...attributes} />
}

// ─── Drag Handle ─────────────────────────────────────
function DragHandle({ id }: { id: string }) {
  const { listeners, setActivatorNodeRef } = useSortable({ id })

  return (
    <Tooltip title="Drag to reorder" placement="left">
      <Button
        type="text"
        size="small"
        icon={<HolderOutlined />}
        style={{ cursor: "grab", color: "#555" }}
        ref={setActivatorNodeRef}
        {...listeners}
      />
    </Tooltip>
  )
}

// ─── Tab Content with drag-drop + error handling ─────
function TabContent({
  resource,
  columns,
  minItems = 0,
  maxItems,
  emptyMessage,
}: {
  resource: string
  columns: { key: string; title: string; width?: number; ellipsis?: boolean; render?: (v: any) => string }[]
  minItems?: number
  maxItems?: number
  emptyMessage?: string
}) {
  const { tableProps, tableQuery } = useTable({
    resource,
    sorters: { initial: [{ field: "sort_order", order: "asc" }] },
    pagination: { pageSize: 100 },
  })

  const { mutate: updateOne } = useUpdate()
  const [saving, setSaving] = useState(false)

  const dataSource = (tableProps.dataSource as any[]) || []
  const totalItems = dataSource.length
  const canDelete = totalItems > minItems
  const isError = tableQuery?.isError

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = dataSource.findIndex((i) => i.id === active.id)
      const newIndex = dataSource.findIndex((i) => i.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(dataSource, oldIndex, newIndex)
      setSaving(true)

      let completed = 0
      const total = reordered.filter((item, idx) => item.sort_order !== idx).length

      if (total === 0) {
        setSaving(false)
        return
      }

      reordered.forEach((item, idx) => {
        if (item.sort_order !== idx) {
          updateOne(
            { resource, id: item.id, values: { sort_order: idx } },
            {
              onSuccess: () => {
                completed++
                if (completed >= total) {
                  tableQuery?.refetch()
                  setSaving(false)
                  message.success("Order updated")
                }
              },
              onError: () => {
                setSaving(false)
                message.error("Failed to update order")
              },
            }
          )
        }
      })
    },
    [dataSource, resource, updateOne, tableQuery]
  )

  if (isError) {
    return (
      <Alert
        message="Failed to load data"
        description="Make sure the database table exists and you have the correct permissions."
        type="error"
        showIcon
        action={<Button size="small" onClick={() => tableQuery?.refetch()}>Retry</Button>}
      />
    )
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {saving ? (
            <Tag color="processing">Saving order...</Tag>
          ) : totalItems > 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              <HolderOutlined style={{ marginRight: 4 }} />
              Drag to reorder · {totalItems}{maxItems ? `/${maxItems}` : ""} item{totalItems !== 1 ? "s" : ""}
              {minItems > 0 && ` · Min ${minItems}`}
              {maxItems && ` · Max ${maxItems}`}
            </Text>
          ) : null}
        </div>
        {maxItems && totalItems >= maxItems ? (
          <Tooltip title={`Maximum ${maxItems} items allowed`}>
            <Button size="small" disabled>Create</Button>
          </Tooltip>
        ) : (
          <CreateButton resource={resource} size="small" />
        )}
      </div>

      {totalItems === 0 ? (
        <Empty
          description={emptyMessage || "No items yet. Click 'Create' to add one."}
          style={{ padding: "30px 0" }}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={dataSource.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <Table
              {...tableProps}
              rowKey="id"
              size="small"
              components={{ body: { row: SortableRow } }}
              pagination={false}
            >
              <Table.Column
                title=""
                width={40}
                render={(_: any, record: any) => <DragHandle id={record.id} />}
              />
              {columns.map((col) => (
                <Table.Column
                  key={col.key}
                  dataIndex={col.key}
                  title={col.title}
                  width={col.width}
                  ellipsis={col.ellipsis}
                  render={col.render}
                />
              ))}
              <Table.Column
                title=""
                render={(_: any, record: any) => (
                  <Space>
                    <EditButton hideText size="small" recordItemId={record.id} resource={resource} />
                    {canDelete ? (
                      <DeleteButton hideText size="small" recordItemId={record.id} resource={resource} />
                    ) : (
                      <Tooltip title="At least one item required">
                        <Button size="small" disabled danger icon={<DeleteOutlined />} />
                      </Tooltip>
                    )}
                  </Space>
                )}
                width={90}
              />
            </Table>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

// ─── Section Header Editor ───────────────────────────
function SectionHeaderEditor({ sectionKey, showImage = false }: { sectionKey: string; showImage?: boolean }) {
  const { data, isLoading, isError } = useList({
    resource: "cms_section_headers",
    filters: [{ field: "section_key", operator: "eq", value: sectionKey }],
    pagination: { pageSize: 1 },
  })

  const { mutate, isLoading: isSaving } = useUpdate()
  const [editing, setEditing] = useState(false)
  const [formKey, setFormKey] = useState(0)

  const record = data?.data?.[0] as any

  if (isLoading) return <Spin size="small" style={{ display: "block", margin: "16px auto" }} />

  if (isError) {
    return (
      <Alert
        message="Could not load section header"
        type="error"
        showIcon
        style={{ marginBottom: 16 }}
      />
    )
  }

  if (!record) {
    return (
      <Alert
        message="Section header not configured"
        description="Run the section headers SQL seed in Supabase to enable header editing."
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 16 }}
      />
    )
  }

  // Read-only view
  if (!editing) {
    return (
      <Card
        size="small"
        style={{ marginBottom: 16, borderColor: "rgba(77,182,172,0.15)" }}
        title={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>Section Header</span>
            </div>
            <Button size="small" type="link" onClick={() => setEditing(true)}>Edit</Button>
          </div>
        }
      >
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          {showImage && (
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Image</Text>
              {record.image_url ? (
                <img src={record.image_url} alt="Section" style={{ width: 100, height: 70, objectFit: "cover", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)" }} />
              ) : (
                <Text type="danger" style={{ fontSize: 12 }}>No image uploaded</Text>
              )}
            </div>
          )}
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: "block" }}>Subtitle</Text>
            <Text style={{ fontSize: 13 }}>{record.subtitle || "—"}</Text>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: "block" }}>Title</Text>
            <Text strong style={{ fontSize: 13 }}>{record.title || "—"}</Text>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Text type="secondary" style={{ fontSize: 11, display: "block" }}>Description</Text>
            <Text style={{ fontSize: 13 }}>{record.description || "—"}</Text>
          </div>
        </div>
      </Card>
    )
  }

  // Edit view
  return (
    <Card
      size="small"
      style={{ marginBottom: 16, borderColor: "rgba(77,182,172,0.3)" }}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span>Section Header</span>
          <Tag color="cyan" style={{ fontSize: 10, lineHeight: "16px" }}>Editing</Tag>
        </div>
      }
    >
      <Form
        key={formKey}
        layout="vertical"
        initialValues={{
          subtitle: record.subtitle || "",
          title: record.title || "",
          description: record.description || "",
          image_url: record.image_url || "",
        }}
        onFinish={(values) => {
          mutate(
            { resource: "cms_section_headers", id: record.id, values },
            {
              onSuccess: () => {
                message.success("Section header updated")
                setEditing(false)
              },
              onError: () => message.error("Failed to update header"),
            }
          )
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Form.Item
            label="Subtitle"
            name="subtitle"
            style={{ marginBottom: 12 }}
            extra="Small uppercase text above the title"
          >
            <Input placeholder="e.g. Why Choose Us" />
          </Form.Item>
          <Form.Item
            label="Title"
            name="title"
            rules={[{ required: true, message: "Title is required" }]}
            style={{ marginBottom: 12 }}
            extra="Use {brand} to insert brand name dynamically"
          >
            <Input placeholder="e.g. The {brand} Experience" />
          </Form.Item>
        </div>
        <Form.Item
          label="Description"
          name="description"
          style={{ marginBottom: 12 }}
          extra="Shown below the title. Keep it under 2 lines."
        >
          <Input.TextArea
            rows={2}
            maxLength={200}
            showCount
            placeholder="Short description about this section..."
          />
        </Form.Item>
        {showImage && (
          <Form.Item
            label="Section Image"
            name="image_url"
            rules={[{ required: true, message: "Section image is required" }]}
            style={{ marginBottom: 12 }}
          >
            <ImageUpload
              folder="reviews"
              aspectHint="Recommended: 800×460px, 16:9 ratio. Shows on the left side of the reviews carousel."
              required
            />
          </Form.Item>
        )}
        <Space>
          <Button
            type="primary"
            size="small"
            htmlType="submit"
            loading={isSaving}
            icon={<SaveOutlined />}
          >
            Save
          </Button>
          <Button
            size="small"
            onClick={() => {
              setFormKey((k) => k + 1)
              setEditing(false)
            }}
          >
            Cancel
          </Button>
        </Space>
      </Form>
    </Card>
  )
}

// ─── Review Source Toggle ────────────────────────────
function ReviewSourceToggle() {
  const { data, isLoading } = useList({
    resource: "cms_homepage_settings",
    filters: [{ field: "section_key", operator: "eq", value: "reviews" }],
    pagination: { pageSize: 1 },
    liveMode: "off",
  })

  const { data: dynamicReviewsData } = useList({
    resource: "product_reviews",
    filters: [{ field: "status", operator: "eq", value: "approved" }],
    pagination: { pageSize: 1 },
    meta: { count: "exact" },
    liveMode: "off",
    queryOptions: { retry: false },
  })

  const { mutate } = useUpdate()
  const record = data?.data?.[0] as any
  const config = record?.config || {}
  const source = config.review_source || "static"
  const dynamicCount = dynamicReviewsData?.total || 0
  const canEnableDynamic = dynamicCount >= 4

  if (isLoading || !record) return null

  const handleChange = (newSource: string) => {
    if (newSource === "dynamic" && !canEnableDynamic) return
    mutate({
      resource: "cms_homepage_settings",
      id: record.id,
      values: { config: { ...config, review_source: newSource } },
    })
  }

  return (
    <Card size="small" style={{ marginBottom: 16, borderColor: "rgba(77,182,172,0.15)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <Text strong style={{ fontSize: 13 }}>Review Source</Text>
          <Text type="secondary" style={{ display: "block", fontSize: 12 }}>
            {source === "static"
              ? "Showing manually curated reviews from the list below"
              : "Showing real customer reviews from verified purchases"}
          </Text>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Button
            size="small"
            type={source === "static" ? "primary" : "default"}
            onClick={() => handleChange("static")}
          >
            Static
          </Button>
          <Tooltip title={
            canEnableDynamic
              ? "Shows approved reviews from verified purchases. Reviews are collected via email 3 days after delivery."
              : `Need at least 4 approved reviews to enable (currently ${dynamicCount})`
          }>
            <Button
              size="small"
              type={source === "dynamic" ? "primary" : "default"}
              disabled={!canEnableDynamic && source !== "dynamic"}
              onClick={() => handleChange("dynamic")}
            >
              Dynamic ({dynamicCount})
            </Button>
          </Tooltip>
        </div>
      </div>
      {!canEnableDynamic && source === "static" && (
        <Alert
          style={{ marginTop: 12 }}
          type="warning"
          showIcon
          message={`${dynamicCount} of 4 required approved reviews`}
          description="Dynamic mode requires at least 4 approved customer reviews. Reviews are collected automatically via email 3 days after delivery."
        />
      )}
      {source === "dynamic" && !canEnableDynamic && (
        <Alert
          style={{ marginTop: 12 }}
          type="error"
          showIcon
          message={`Approved reviews dropped below 4 (currently ${dynamicCount})`}
          description="Static reviews will be shown as fallback until at least 4 approved reviews exist. Switch back to Static mode or approve more reviews."
        />
      )}
      {source === "dynamic" && canEnableDynamic && (
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          message="Dynamic reviews are active"
          description={`Showing ${dynamicCount} approved customer reviews (4★+). Static reviews below are ignored. Reviews are collected via email 3 days after delivery.`}
        />
      )}
    </Card>
  )
}

// ─── Dynamic Reviews Browser ─────────────────────────
function DynamicReviewsBrowser() {
  const [ratingFilter, setRatingFilter] = useState<number | null>(null)

  const filters: any[] = [{ field: "status", operator: "eq", value: "approved" }]
  if (ratingFilter) {
    filters.push({ field: "rating", operator: "eq", value: ratingFilter })
  }

  const { tableProps, tableQuery } = useTable({
    resource: "product_reviews",
    sorters: { initial: [{ field: "created_at", order: "desc" }] },
    filters: { initial: filters, permanent: [{ field: "status", operator: "eq", value: "approved" }] },
    pagination: { pageSize: 10 },
    liveMode: "off",
    queryOptions: { retry: false },
  })

  const { mutate } = useUpdate()

  const handleToggleFeatured = (id: string, current: boolean) => {
    mutate(
      { resource: "product_reviews", id, values: { is_featured: !current } },
      { onSuccess: () => { tableQuery?.refetch(); message.success(current ? "Removed from featured" : "Added to featured") } }
    )
  }

  return (
    <div>
      {/* Star rating filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Filter by rating:</Text>
        <div style={{ display: "flex", gap: 4 }}>
          <Button
            size="small"
            type={ratingFilter === null ? "primary" : "default"}
            onClick={() => setRatingFilter(null)}
          >
            All
          </Button>
          {[5, 4, 3, 2, 1].map((star) => (
            <Button
              key={star}
              size="small"
              type={ratingFilter === star ? "primary" : "default"}
              onClick={() => setRatingFilter(ratingFilter === star ? null : star)}
            >
              {star}★
            </Button>
          ))}
        </div>
      </div>

      <Table {...tableProps} rowKey="id" size="small">
        <Table.Column
          dataIndex="is_featured"
          title="Featured"
          width={80}
          render={(v: boolean, record: any) => (
            <Switch
              size="small"
              checked={v}
              onChange={() => handleToggleFeatured(record.id, v)}
            />
          )}
        />
        <Table.Column dataIndex="customer_name" title="Customer" />
        <Table.Column dataIndex="rating" title="Rating" width={70} render={(v: number) => `${v}★`} />
        <Table.Column dataIndex="product_name" title="Product" ellipsis />
        <Table.Column dataIndex="text" title="Review" ellipsis />
        <Table.Column
          dataIndex="created_at"
          title="Date"
          width={100}
          render={(v: string) => new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        />
      </Table>
    </div>
  )
}

// ─── Reviews Tab Content (switches static/dynamic) ───
function ReviewsTabContent({ activeRender }: { activeRender: (v: boolean) => any }) {
  const { data, isLoading } = useList({
    resource: "cms_homepage_settings",
    filters: [{ field: "section_key", operator: "eq", value: "reviews" }],
    pagination: { pageSize: 1 },
    liveMode: "off",
  })

  const record = data?.data?.[0] as any
  const source = record?.config?.review_source || "static"

  if (isLoading) return <Spin />

  if (source === "dynamic") {
    return (
      <div>
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Browse and manage real customer reviews. Toggle "Featured" to highlight specific reviews on the homepage.
          </Text>
        </div>
        <DynamicReviewsBrowser />
      </div>
    )
  }

  return (
    <TabContent
      resource="cms_reviews"
      minItems={4}
      maxItems={7}
      emptyMessage="No reviews yet. Add at least 4 customer testimonials."
      columns={[
        { key: "name", title: "Customer" },
        { key: "rating", title: "Rating", width: 70 },
        { key: "product_name", title: "Product" },
        { key: "is_active", title: "Status", width: 90, render: activeRender as any },
      ]}
    />
  )
}

// ─── Homepage Layout ─────────────────────────────────
export const Homepage = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const menuItems = [
    { key: "/homepage", icon: <SettingOutlined />, label: "Overview" },
    { key: "/homepage/promo", icon: <TagsOutlined />, label: "Promo Banners" },
    { key: "/homepage/reviews", icon: <StarOutlined />, label: "Reviews" },
    { key: "/homepage/experience", icon: <ThunderboltOutlined />, label: "Experience" },
    { key: "/homepage/find-store", icon: <SettingOutlined />, label: "Find a Store" },
  ]

  return (
    <div style={{ display: "flex", gap: 24 }}>
      {/* Sub-navigation */}
      <div style={{ width: 200, flexShrink: 0 }}>
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ border: "none", background: "transparent" }}
        />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Outlet />
      </div>
    </div>
  )
}

// ─── Overview Page (Section Toggles + Required Sections) ─────────────────
export const HomepageOverview = () => {
  const activeRender = (v: boolean) => v ? <Tag color="success">Active</Tag> : <Tag>Draft</Tag>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Homepage Settings</Title>
        <Text type="secondary">Manage section visibility and always-on content</Text>
      </div>

      <SectionToggles />

      <Divider style={{ margin: "24px 0" }} />

      {/* Hero Slides — always visible */}
      <Title level={5} style={{ marginBottom: 12 }}>Hero Slides</Title>
      <TabContent
        resource="cms_hero_slides"
        emptyMessage="No hero slides yet. Add your first slide to get started."
        columns={[
          { key: "headline_line1", title: "Headline 1" },
          { key: "headline_line2", title: "Headline 2" },
          { key: "cta_label", title: "CTA", width: 120 },
          { key: "is_active", title: "Status", width: 90, render: activeRender as any },
        ]}
      />

      <Divider style={{ margin: "24px 0" }} />

      {/* Explore by Style — always visible */}
      <HomepageCategories />
    </div>
  )
}


// ─── Promo Banners Page ──────────────────────────────
export const HomepagePromo = () => {
  const activeRender = (v: boolean) => v ? <Tag color="success">Active</Tag> : <Tag>Draft</Tag>

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Promo Banners</Title>
      <TabContent
        resource="cms_promo_banners"
        emptyMessage="No promo banners yet. Add banners to highlight special offers."
        columns={[
          { key: "title", title: "Title" },
          { key: "subtitle", title: "Subtitle" },
          { key: "is_active", title: "Status", width: 90, render: activeRender as any },
        ]}
      />
    </div>
  )
}

// ─── Reviews Page ────────────────────────────────────
export const HomepageReviews = () => {
  const activeRender = (v: boolean) => v ? <Tag color="success">Active</Tag> : <Tag>Draft</Tag>

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Reviews</Title>
      <SectionHeaderEditor sectionKey="reviews" showImage />
      <ReviewSourceToggle />
      <ReviewsTabContent activeRender={activeRender} />
    </div>
  )
}

// ─── Experience Page ─────────────────────────────────
export const HomepageExperience = () => {
  const activeRender = (v: boolean) => v ? <Tag color="success">Active</Tag> : <Tag>Draft</Tag>

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Experience</Title>
      <SectionHeaderEditor sectionKey="experience" />
      <TabContent
        resource="cms_experience_features"
        minItems={1}
        maxItems={5}
        emptyMessage="Add at least one experience feature to showcase your brand values."
        columns={[
          { key: "title", title: "Title" },
          { key: "description", title: "Description", ellipsis: true },
          { key: "icon_name", title: "Icon", width: 90 },
          { key: "cta_label", title: "CTA", width: 100 },
          { key: "is_active", title: "Status", width: 90, render: activeRender as any },
        ]}
      />
    </div>
  )
}

// ─── Explore by Style (Category Picker) ─────────────
type MedusaCategory = {
  id: string
  name: string
  handle: string
  parent_category: { id: string } | null
  metadata?: Record<string, unknown>
}

const HomepageCategories = () => {
  const [medusaCategories, setMedusaCategories] = useState<MedusaCategory[]>([])
  const [loadingMedusa, setLoadingMedusa] = useState(true)

  const { data, isLoading, isError, refetch } = useList({
    resource: "cms_homepage_categories",
    sorters: [{ field: "sort_order", order: "asc" }],
    pagination: { pageSize: 50 },
    queryOptions: { retry: false },
  })

  const { mutate: updateOne } = useUpdate()
  const { mutate: createOne } = useCreate()
  const { mutate: deleteOne } = useDelete()
  const [saving, setSaving] = useState(false)

  const selected = (data?.data as any[]) || []
  const selectedIds = new Set(selected.map((s) => s.category_id))

  // Fetch categories from Medusa
  useEffect(() => {
    const url = import.meta.env.VITE_MEDUSA_BACKEND_URL || "http://localhost:9000"
    const key = import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY

    fetch(`${url}/store/product-categories?limit=50&fields=id,name,handle,parent_category,metadata`, {
      headers: key ? { "x-publishable-api-key": key } : {},
    })
      .then((res) => res.json())
      .then((data) => {
        const cats = (data.product_categories || []).filter(
          (c: MedusaCategory) => !c.parent_category
        )
        setMedusaCategories(cats)
      })
      .catch(() => message.error("Failed to load categories from Medusa"))
      .finally(() => setLoadingMedusa(false))
  }, [])

  const availableCategories = medusaCategories.filter((c) => !selectedIds.has(c.id))

  const handleAdd = (categoryId: string) => {
    const cat = medusaCategories.find((c) => c.id === categoryId)
    if (!cat) return

    createOne(
      {
        resource: "cms_homepage_categories",
        values: {
          category_id: cat.id,
          category_name: cat.name,
          category_handle: cat.handle,
          cover_image: (cat.metadata?.cover_image as string) || null,
          sort_order: selected.length,
          is_active: true,
        },
      },
      {
        onSuccess: () => {
          message.success(`Added "${cat.name}"`)
          refetch()
        },
        onError: () => message.error("Failed to add category"),
      }
    )
  }

  const handleRemove = (id: string, name: string) => {
    deleteOne(
      { resource: "cms_homepage_categories", id },
      {
        onSuccess: () => {
          message.success(`Removed "${name}"`)
          refetch()
        },
        onError: () => message.error("Failed to remove category"),
      }
    )
  }

  const handleToggle = (id: string, checked: boolean) => {
    updateOne(
      { resource: "cms_homepage_categories", id, values: { is_active: checked } },
      { onSuccess: () => refetch() }
    )
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = selected.findIndex((i: any) => i.id === active.id)
      const newIndex = selected.findIndex((i: any) => i.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(selected, oldIndex, newIndex)
      setSaving(true)

      let completed = 0
      const total = reordered.filter((item: any, idx: number) => item.sort_order !== idx).length

      if (total === 0) { setSaving(false); return }

      reordered.forEach((item: any, idx: number) => {
        if (item.sort_order !== idx) {
          updateOne(
            { resource: "cms_homepage_categories", id: item.id, values: { sort_order: idx } },
            {
              onSuccess: () => {
                completed++
                if (completed >= total) {
                  refetch()
                  setSaving(false)
                  message.success("Order updated")
                }
              },
              onError: () => { setSaving(false); message.error("Failed to reorder") },
            }
          )
        }
      })
    },
    [selected, updateOne, refetch]
  )

  if (isLoading || loadingMedusa) {
    return <Spin tip="Loading..."><div style={{ minHeight: 100 }} /></Spin>
  }

  if (isError) {
    return (
      <div>
        <Title level={4} style={{ marginBottom: 16 }}>Explore by Style</Title>
        <Alert
          message="Table not found"
          description={<>Run the SQL file <code>cms-admin/supabase/create-homepage-categories.sql</code> in your Supabase SQL Editor to create the required table.</>}
          type="warning"
          showIcon
        />
      </div>
    )
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 4 }}>Explore by Style</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 16, fontSize: 13 }}>
        Select which product categories appear in the "Explore by Style" carousel on the homepage.
        {medusaCategories.length === 0 && " No categories found in Medusa — add some first."}
      </Text>

      {/* Add category */}
      {availableCategories.length > 0 && (
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Select
            placeholder="Add a category..."
            style={{ width: 280 }}
            showSearch
            optionFilterProp="label"
            value={null as any}
            onChange={handleAdd}
            options={availableCategories.map((c) => ({
              value: c.id,
              label: c.name,
            }))}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {availableCategories.length} available
          </Text>
        </div>
      )}

      {selected.length === 0 ? (
        <Empty description="No categories selected. Use the dropdown above to add categories." style={{ padding: "30px 0" }} />
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            {saving ? (
              <Tag color="processing">Saving order...</Tag>
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>
                <HolderOutlined style={{ marginRight: 4 }} />
                Drag to reorder · {selected.length} categor{selected.length === 1 ? "y" : "ies"}
              </Text>
            )}
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={selected.map((i: any) => i.id)} strategy={verticalListSortingStrategy}>
              <Table
                dataSource={selected}
                rowKey="id"
                size="small"
                pagination={false}
                components={{ body: { row: SortableRow } }}
              >
                <Table.Column
                  title=""
                  width={40}
                  render={(_: any, record: any) => <DragHandle id={record.id} />}
                />
                <Table.Column
                  dataIndex="cover_image"
                  title="Image"
                  width={60}
                  render={(url: string) =>
                    url ? (
                      <img src={url} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <AppstoreOutlined style={{ color: "#555", fontSize: 14 }} />
                      </div>
                    )
                  }
                />
                <Table.Column dataIndex="category_name" title="Category" />
                <Table.Column dataIndex="category_handle" title="Handle" render={(v: string) => <Text type="secondary">/{v}</Text>} />
                <Table.Column
                  dataIndex="is_active"
                  title="Visible"
                  width={80}
                  render={(v: boolean, record: any) => (
                    <Switch size="small" checked={v} onChange={(checked) => handleToggle(record.id, checked)} />
                  )}
                />
                <Table.Column
                  title=""
                  width={50}
                  render={(_: any, record: any) => (
                    <Tooltip title="Remove from homepage">
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemove(record.id, record.category_name)} />
                    </Tooltip>
                  )}
                />
              </Table>
            </SortableContext>
          </DndContext>
        </div>
      )}

    </div>
  )
}

// ─── Find a Store Config ─────────────────────────────
export const HomepageFindStore = () => {
  const { data, isLoading, refetch } = useList({
    resource: "cms_homepage_settings",
    filters: [{ field: "section_key", operator: "eq", value: "find_store" }],
    pagination: { pageSize: 1 },
    liveMode: "off",
  })

  const { mutate, isLoading: isSaving } = useUpdate()
  const [form] = Form.useForm()
  const [editing, setEditing] = useState(false)

  const record = data?.data?.[0] as any
  const config = record?.config || {}

  const heading = config.heading || "Visit Our Store"
  const description = config.description || ""
  const showAddress = config.show_address !== false
  const showHours = config.show_hours !== false

  if (isLoading) return <Spin><div style={{ minHeight: 200 }} /></Spin>

  if (!record) {
    return (
      <div>
        <Title level={4} style={{ marginBottom: 16 }}>Find a Store</Title>
        <Alert
          message="Section not configured"
          description="Make sure 'find_store' exists in the cms_homepage_settings table."
          type="warning"
          showIcon
        />
      </div>
    )
  }

  const handleSave = (values: any) => {
    const newConfig = {
      ...config,
      heading: values.heading,
      description: values.description || "",
      show_address: values.show_address,
      show_hours: values.show_hours,
    }
    mutate(
      { resource: "cms_homepage_settings", id: record.id, values: { config: newConfig } },
      {
        onSuccess: () => {
          message.success("Find a Store settings saved")
          setEditing(false)
          refetch()
        },
        onError: () => message.error("Failed to save"),
      }
    )
  }

  // Read-only view
  if (!editing) {
    return (
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>Find a Store</Title>
        <Text type="secondary" style={{ display: "block", marginBottom: 16, fontSize: 13 }}>
          Configure what appears in the homepage store section.
          Contact details are managed in <a href="/settings" style={{ color: "#4db6ac" }}>Store Info</a>.
        </Text>

        <Card
          size="small"
          style={{ borderColor: "rgba(77,182,172,0.15)" }}
          title={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Section Settings</span>
              <Button size="small" type="link" onClick={() => {
                form.setFieldsValue({
                  heading,
                  description,
                  show_address: showAddress,
                  show_hours: showHours,
                })
                setEditing(true)
              }}>Edit</Button>
            </div>
          }
        >
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: "block" }}>Heading</Text>
              <Text strong style={{ fontSize: 13 }}>{heading}</Text>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Text type="secondary" style={{ fontSize: 11, display: "block" }}>Description</Text>
              <Text style={{ fontSize: 13 }}>{description || "—"}</Text>
            </div>
          </div>
          <Divider style={{ margin: "12px 0" }} />
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Tag color={showAddress ? "success" : "default"}>Address: {showAddress ? "Visible" : "Hidden"}</Tag>
            <Tag color="success">Phone: Always visible</Tag>
            <Tag color={showHours ? "success" : "default"}>Hours: {showHours ? "Visible" : "Hidden"}</Tag>
            <Tag color="success">Get Directions: Always visible</Tag>
          </div>
        </Card>
      </div>
    )
  }

  // Edit view
  return (
    <div>
      <Title level={4} style={{ marginBottom: 4 }}>Find a Store</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 16, fontSize: 13 }}>
        Configure what appears in the homepage store section.
        Contact details are managed in <a href="/settings" style={{ color: "#4db6ac" }}>Store Info</a>.
      </Text>

      <Card
        size="small"
        style={{ borderColor: "rgba(77,182,172,0.3)" }}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>Section Settings</span>
            <Tag color="cyan" style={{ fontSize: 10, lineHeight: "16px" }}>Editing</Tag>
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            label="Heading"
            name="heading"
            rules={[{ required: true, message: "Heading is required" }]}
            style={{ marginBottom: 12 }}
          >
            <Input placeholder="Visit Our Store" />
          </Form.Item>

          <Form.Item
            label="Description"
            name="description"
            style={{ marginBottom: 16 }}
            extra="Short text below the heading. Leave empty to hide."
          >
            <Input.TextArea rows={2} maxLength={200} showCount placeholder="Experience our collection in person..." />
          </Form.Item>

          <Divider style={{ margin: "12px 0" }} />

          <Text strong style={{ fontSize: 13, display: "block", marginBottom: 12 }}>Visible Fields</Text>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <Text style={{ fontSize: 13 }}>Address</Text>
                <Text type="secondary" style={{ display: "block", fontSize: 11 }}>Store name, address, city, state, pincode</Text>
              </div>
              <Form.Item name="show_address" valuePropName="checked" noStyle>
                <Switch size="small" />
              </Form.Item>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <Text style={{ fontSize: 13 }}>Phone</Text>
                <Text type="secondary" style={{ display: "block", fontSize: 11 }}>Always shown — clickable call link</Text>
              </div>
              <Switch size="small" checked disabled />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <Text style={{ fontSize: 13 }}>Business Hours</Text>
                <Text type="secondary" style={{ display: "block", fontSize: 11 }}>Grouped day-wise hours from Store Info</Text>
              </div>
              <Form.Item name="show_hours" valuePropName="checked" noStyle>
                <Switch size="small" />
              </Form.Item>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <Text style={{ fontSize: 13 }}>Get Directions</Text>
                <Text type="secondary" style={{ display: "block", fontSize: 11 }}>Always shown — opens Google Maps</Text>
              </div>
              <Switch size="small" checked disabled />
            </div>
          </div>

          <Space>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="small" loading={isSaving}>
              Save
            </Button>
            <Button size="small" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  )
}
