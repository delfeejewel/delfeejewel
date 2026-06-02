import { useList, useCreate, useUpdate, useDelete, useInvalidate } from "@refinedev/core"
import {
  Space,
  Button,
  Form,
  Input,
  Select,
  Switch,
  Tag,
  Divider,
  Typography,
  Popconfirm,
  message,
  Card,
  Spin,
  Radio,
  Checkbox,
  Alert,
} from "antd"
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
  CloseOutlined,
  HolderOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons"
import { useState, useCallback, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

const { Title, Text } = Typography

/* ─── List (read-only overview) ────────────────────── */

export const MenuList = () => {
  const navigate = useNavigate()
  const { data: menusData, isLoading: menusLoading } = useList({
    resource: "cms_menus",
    sorters: [{ field: "name", order: "asc" }],
    pagination: { pageSize: 50 },
  })

  const { data: itemsData } = useList({
    resource: "cms_menu_items",
    pagination: { pageSize: 500 },
    queryOptions: { enabled: !!menusData?.data?.length },
  })

  const menus: any[] = menusData?.data || []
  const allItems: any[] = itemsData?.data || []

  const countFor = (menuId: string) =>
    allItems.filter((it: any) => it.menu_id === menuId).length

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Menus</Title>
          <Text type="secondary">
            {menusLoading
              ? "Loading…"
              : menus.length === 0
              ? "No menus yet"
              : `${menus.length} menu${menus.length !== 1 ? "s" : ""}`}
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/menus/create")}>
          Add Menu
        </Button>
      </div>

      <Card>
        {menusLoading ? (
          <Spin tip="Loading..."><div style={{ minHeight: 120 }} /></Spin>
        ) : menus.length === 0 ? (
          <Text type="secondary" style={{ display: "block", padding: "24px 0", textAlign: "center", fontStyle: "italic" }}>
            No menus yet. Click Add Menu to create one.
          </Text>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {menus.map((menu: any, i: number) => {
              const n = countFor(menu.id)
              return (
                <div
                  key={menu.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 4px",
                    borderBottom: i < menus.length - 1 ? "1px solid rgba(255,255,255,0.06)" : undefined,
                  }}
                >
                  <Text strong style={{ fontSize: 14 }}>{menu.name}</Text>
                  <Space size={12}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {n} item{n !== 1 ? "s" : ""}
                    </Text>
                    <Tag color={menu.is_active ? "green" : undefined}>
                      {menu.is_active ? "Active" : "Hidden"}
                    </Tag>
                    <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/menus/edit/${menu.id}`)}>
                      Edit
                    </Button>
                  </Space>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

/* ─── Medusa category type ──────────────────────────── */

type MedusaCategory = { id: string; name: string; handle: string }

function useMedusaCategories() {
  const [categories, setCategories] = useState<MedusaCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const fetched = useRef(false)

  const fetch_ = useCallback(() => {
    if (fetched.current) return
    fetched.current = true
    setLoading(true)
    const url = import.meta.env.VITE_MEDUSA_BACKEND_URL || "http://localhost:9000"
    const key = import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY || ""
    fetch(`${url}/store/product-categories?limit=100&fields=id,name,handle`, {
      headers: key ? { "x-publishable-api-key": key } : {},
    })
      .then((r) => r.json())
      .then((data) => setCategories(data.product_categories || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return { categories, loading, error, fetch: fetch_ }
}

/* ─── Create ────────────────────────────────────────── */

const MENU_TYPE_OPTIONS = [
  { value: "pre_defined", label: "Pre Defined" },
  { value: "custom", label: "Custom Links" },
]

const PRE_DEFINED_SOURCE_OPTIONS = [
  { value: "pages", label: "Pages" },
  { value: "categories", label: "Categories" },
  { value: "collections", label: "Collections" },
]

export const MenuCreate = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const menuType        = Form.useWatch("menu_type", form)
  const preDefinedSource = Form.useWatch("pre_defined_source", form)
  const categoryScope   = Form.useWatch("category_scope", form)
  const pageScope       = Form.useWatch("page_scope", form)

  const { mutate: create, isLoading: saving } = useCreate()
  const { mutate: createItem } = useCreate()

  // ── Categories (Medusa) ──
  const { categories, loading: loadingCats, error: catError, fetch: fetchCats } = useMedusaCategories()
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  useEffect(() => {
    if (preDefinedSource === "categories") fetchCats()
  }, [preDefinedSource, fetchCats])

  // ── Pages (Supabase) — always fetched so data is ready when the user selects Pages
  const { data: pagesData, isLoading: loadingPages } = useList({
    resource: "cms_pages",
    sorters: [{ field: "title", order: "asc" }],
    pagination: { pageSize: 100 },
  })
  const pages: any[] = pagesData?.data || []
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([])

  // ── Derived flags ──
  const isPreDefined      = menuType === "pre_defined"
  const showCategoryPicker = isPreDefined && preDefinedSource === "categories"
  const showPagePicker     = isPreDefined && preDefinedSource === "pages"

  const saveDisabled =
    (showCategoryPicker && categoryScope === "select" && selectedCategoryIds.length === 0) ||
    (showPagePicker     && pageScope      === "select" && selectedPageIds.length      === 0)

  // ── Save handler ──
  const handleSave = (values: any) => {
    const { menu_type, pre_defined_source, category_scope, page_scope, ...menuValues } = values

    create(
      { resource: "cms_menus", values: { ...menuValues, location: null, sort_order: 0 } },
      {
        onSuccess: (data: any) => {
          const menuId = data.data.id

          if (pre_defined_source === "categories") {
            const toAdd =
              category_scope === "all"
                ? categories
                : categories.filter((c) => selectedCategoryIds.includes(c.id))
            toAdd.forEach((cat, idx) =>
              createItem({
                resource: "cms_menu_items",
                values: { menu_id: menuId, label: cat.name, href: `/categories/${cat.handle}`, sort_order: idx, is_active: true },
              })
            )
          }

          if (pre_defined_source === "pages") {
            const toAdd =
              page_scope === "all"
                ? pages
                : pages.filter((p: any) => selectedPageIds.includes(p.id))
            toAdd.forEach((page: any, idx: number) =>
              createItem({
                resource: "cms_menu_items",
                values: { menu_id: menuId, label: page.title, href: `/${page.slug}`, sort_order: idx, is_active: true },
              })
            )
          }

          message.success("Menu created")
          navigate(`/menus/edit/${menuId}`)
        },
        onError: () => message.error("Failed to create menu"),
      }
    )
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/menus")} />
        <Title level={3} style={{ margin: 0 }}>Add Menu</Title>
      </div>

      <Card style={{ maxWidth: 600 }}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ is_active: true }}>

          <Form.Item label="Menu Name" name="name" rules={[{ required: true, message: "Menu name is required" }]}>
            <Input placeholder="e.g. Customer Service" />
          </Form.Item>

          <Form.Item label="Menu Type" name="menu_type" rules={[{ required: true, message: "Select a menu type" }]}>
            <Select placeholder="Select type" options={MENU_TYPE_OPTIONS} />
          </Form.Item>

          {isPreDefined && (
            <Form.Item label="Source" name="pre_defined_source" rules={[{ required: true, message: "Select a source" }]}>
              <Select placeholder="Select source" options={PRE_DEFINED_SOURCE_OPTIONS} />
            </Form.Item>
          )}

          {/* ── Categories ── */}
          {showCategoryPicker && (
            <Form.Item name="category_scope" rules={[{ required: true, message: "Choose a scope" }]}>
              <Radio.Group>
                <Space direction="vertical" size={4}>
                  <Radio value="all">All Categories</Radio>
                  <Radio value="select">Select from Categories</Radio>
                </Space>
              </Radio.Group>
            </Form.Item>
          )}
          {showCategoryPicker && categoryScope === "select" && (
            <SourceChecklist
              loading={loadingCats}
              error={catError}
              errorDescription="Make sure the Medusa backend is running and VITE_MEDUSA_PUBLISHABLE_KEY is set."
              emptyText="No categories found"
              items={categories.map((c) => ({ id: c.id, label: c.name, hint: `/${c.handle}` }))}
              selectedIds={selectedCategoryIds}
              onChange={setSelectedCategoryIds}
            />
          )}

          {/* ── Pages ── */}
          {showPagePicker && (
            <Form.Item name="page_scope" rules={[{ required: true, message: "Choose a scope" }]}>
              <Radio.Group>
                <Space direction="vertical" size={4}>
                  <Radio value="all">All Pages</Radio>
                  <Radio value="select">Select from Pages</Radio>
                </Space>
              </Radio.Group>
            </Form.Item>
          )}
          {showPagePicker && pageScope === "select" && (
            <SourceChecklist
              loading={loadingPages}
              error={false}
              errorDescription=""
              emptyText="No pages found"
              items={pages.map((p: any) => ({
                id: p.id,
                label: p.title,
                hint: `/${p.slug}`,
                badge: p.is_published ? undefined : "Draft",
              }))}
              selectedIds={selectedPageIds}
              onChange={setSelectedPageIds}
            />
          )}

          <Form.Item label="Active" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Space style={{ marginTop: 4 }}>
            <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />} disabled={saveDisabled}>
              Create Menu
            </Button>
            <Button onClick={() => navigate("/menus")} disabled={saving}>Cancel</Button>
          </Space>

          {showCategoryPicker && categoryScope === "select" && selectedCategoryIds.length > 0 && (
            <SelectionCount count={selectedCategoryIds.length} noun="categor" plural="ies" singular="y" />
          )}
          {showPagePicker && pageScope === "select" && selectedPageIds.length > 0 && (
            <SelectionCount count={selectedPageIds.length} noun="page" plural="s" singular="" />
          )}

        </Form>
      </Card>
    </div>
  )
}

/* ─── Shared source checklist ───────────────────────── */

function SourceChecklist({
  loading,
  error,
  errorDescription,
  emptyText,
  items,
  selectedIds,
  onChange,
}: {
  loading: boolean
  error: boolean
  errorDescription: string
  emptyText: string
  items: { id: string; label: string; hint: string; badge?: string }[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 8,
        padding: "4px 0",
        marginBottom: 20,
        maxHeight: 320,
        overflowY: "auto",
      }}
    >
      {error ? (
        <Alert type="warning" showIcon message="Could not load items" description={errorDescription} style={{ margin: 12 }} />
      ) : loading ? (
        <div style={{ padding: 24, textAlign: "center" }}><Spin tip="Loading…" /></div>
      ) : items.length === 0 ? (
        <Text type="secondary" style={{ display: "block", padding: 16, textAlign: "center" }}>{emptyText}</Text>
      ) : (
        items.map((item, i) => (
          <label
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 14px",
              cursor: "pointer",
              borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.05)" : undefined,
            }}
          >
            <Checkbox
              checked={selectedIds.includes(item.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selectedIds, item.id]
                    : selectedIds.filter((id) => id !== item.id)
                )
              }
            />
            <span style={{ flex: 1, fontSize: 14 }}>{item.label}</span>
            {item.badge && <Tag style={{ margin: 0 }}>{item.badge}</Tag>}
            <Text type="secondary" style={{ fontSize: 12, fontFamily: "monospace" }}>{item.hint}</Text>
          </label>
        ))
      )}
    </div>
  )
}

function SelectionCount({ count, noun, plural, singular }: { count: number; noun: string; plural: string; singular: string }) {
  return (
    <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
      {count} {noun}{count === 1 ? singular : plural} selected
    </Text>
  )
}

/* ─── Edit (inline: menu fields + items on one page) ── */

export const MenuEdit = () => {
  const navigate = useNavigate()

  const { id = "" } = useParams()

  const { data, isLoading } = useList({
    resource: "cms_menus",
    filters: [{ field: "id", operator: "eq", value: id }],
    pagination: { pageSize: 1 },
    queryOptions: { enabled: !!id },
  })

  const [form] = Form.useForm()
  const [formDirty, setFormDirty] = useState(false)
  const { mutate: update, isLoading: saving } = useUpdate()
  const invalidate = useInvalidate()

  const record = data?.data?.[0] as any

  const handleSave = (values: any) => {
    update(
      { resource: "cms_menus", id, values },
      {
        onSuccess: () => {
          message.success("Menu saved")
          setFormDirty(false)
          invalidate({ resource: "cms_menus", invalidates: ["list"] })
        },
        onError: () => message.error("Failed to save"),
      }
    )
  }

  if (isLoading || !record) {
    return <Spin tip="Loading..."><div style={{ minHeight: 200 }} /></Spin>
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/menus")} />
        <Title level={3} style={{ margin: 0 }}>Edit Menu</Title>
      </div>

      {/* ── Menu properties ── */}
      <Card style={{ maxWidth: 560, marginBottom: 24 }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={record}
          onValuesChange={() => setFormDirty(true)}
          onFinish={handleSave}
        >
          <MenuFields />
          <Button
            type="primary"
            htmlType="submit"
            loading={saving}
            icon={<SaveOutlined />}
            disabled={!formDirty}
          >
            Save menu settings
          </Button>
        </Form>
      </Card>

      {/* ── Menu items ── */}
      <Card>
        <Title level={5} style={{ margin: "0 0 4px" }}>Menu Items</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Links shown in this menu. Drag to reorder.
        </Text>
        <div style={{ marginTop: 16 }}>
          <MenuItemsEditor menuId={id} />
        </div>
      </Card>
    </div>
  )
}

/* ─── Shared menu field set ─────────────────────────── */

const MenuFields = () => (
  <>
    <Form.Item
      label="Menu Name"
      name="name"
      rules={[{ required: true, message: "Name is required" }]}
    >
      <Input placeholder="e.g. Customer Service" />
    </Form.Item>
    <Form.Item label="Active" name="is_active" valuePropName="checked" initialValue={true}>
      <Switch />
    </Form.Item>
  </>
)

/* ─── Items editor (drag-to-reorder) ───────────────── */

function MenuItemsEditor({ menuId }: { menuId: string }) {
  const invalidate = useInvalidate()
  const { data, isLoading } = useList({
    resource: "cms_menu_items",
    filters: [{ field: "menu_id", operator: "eq", value: menuId }],
    sorters: [{ field: "sort_order", order: "asc" }],
    pagination: { pageSize: 100 },
    queryOptions: { retry: false },
  })

  const { mutate: updateItem } = useUpdate()
  const [items, setItems] = useState<any[]>([])

  const serverItems: any[] = data?.data || []

  // Sync from server whenever the fetched list changes (initial load or after add/delete)
  useEffect(() => {
    if (serverItems.length > 0 || items.length > 0) {
      setItems(serverItems)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(serverItems.map((i: any) => i.id))])

  const refresh = useCallback(() => {
    invalidate({ resource: "cms_menu_items", invalidates: ["list"] })
  }, [invalidate])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((it) => it.id === active.id)
    const newIndex = items.findIndex((it) => it.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)
    setItems(reordered)

    // Persist new sort_order values
    reordered.forEach((item, idx) => {
      if (item.sort_order !== idx) {
        updateItem({
          resource: "cms_menu_items",
          id: item.id,
          values: { sort_order: idx },
        })
      }
    })
  }

  if (isLoading) return <Spin tip="Loading items..."><div style={{ minHeight: 60 }} /></Spin>

  return (
    <div>
      {items.length === 0 ? (
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          No items yet — add the first link below.
        </Text>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
            <Space direction="vertical" style={{ width: "100%" }} size={6}>
              {items.map((item) => (
                <SortableItemRow key={item.id} item={item} onChanged={refresh} />
              ))}
            </Space>
          </SortableContext>
        </DndContext>
      )}

      <Divider style={{ margin: "16px 0" }} />
      <AddItemRow menuId={menuId} nextOrder={items.length} onAdded={refresh} />
    </div>
  )
}

/* ─── Sortable item row ─────────────────────────────── */

function SortableItemRow({ item, onChanged }: { item: any; onChanged: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <ItemRow item={item} onChanged={onChanged} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}

/* ─── Item row (read / edit mode) ───────────────────── */

function ItemRow({
  item,
  onChanged,
  dragHandleProps,
}: {
  item: any
  onChanged: () => void
  dragHandleProps?: any
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(item.label)
  const [href, setHref] = useState(item.href)
  const [active, setActive] = useState<boolean>(item.is_active ?? true)
  const { mutate: update, isLoading: saving } = useUpdate()
  const { mutate: remove, isLoading: removing } = useDelete()

  const invalid = !label.trim() || !href.trim()

  const cancel = () => {
    setLabel(item.label)
    setHref(item.href)
    setActive(item.is_active ?? true)
    setEditing(false)
  }

  const save = () => {
    if (invalid) {
      message.error("Label and link are required")
      return
    }
    update(
      {
        resource: "cms_menu_items",
        id: item.id,
        values: { label: label.trim(), href: href.trim(), is_active: active },
      },
      {
        onSuccess: () => {
          message.success("Item saved")
          setEditing(false)
          onChanged()
        },
        onError: () => message.error("Failed to save item"),
      }
    )
  }

  const toggleActive = (checked: boolean) => {
    update(
      { resource: "cms_menu_items", id: item.id, values: { is_active: checked } },
      {
        onSuccess: () => {
          message.success(checked ? "Item shown" : "Item hidden")
          onChanged()
        },
        onError: () => message.error("Failed to update"),
      }
    )
  }

  // ── Read-only row ──
  if (!editing) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          opacity: item.is_active ? 1 : 0.5,
          transition: "opacity 0.2s",
        }}
      >
        {/* Drag handle */}
        <span
          {...dragHandleProps}
          style={{ cursor: "grab", color: "rgba(255,255,255,0.3)", fontSize: 16, lineHeight: 1, touchAction: "none" }}
        >
          <HolderOutlined />
        </span>

        <Text strong style={{ minWidth: 130 }}>{item.label}</Text>
        <Text type="secondary" style={{ flex: 1, fontSize: 13 }}>{item.href}</Text>

        {/* Active toggle — quick toggle without opening edit */}
        <Switch
          size="small"
          checked={item.is_active ?? true}
          onChange={toggleActive}
          checkedChildren="On"
          unCheckedChildren="Off"
        />

        <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(true)} />
        <Popconfirm
          title="Delete this item?"
          onConfirm={() =>
            remove(
              { resource: "cms_menu_items", id: item.id },
              {
                onSuccess: () => {
                  message.success("Item removed")
                  onChanged()
                },
              }
            )
          }
        >
          <Button size="small" icon={<DeleteOutlined />} danger loading={removing} />
        </Popconfirm>
      </div>
    )
  }

  // ── Edit row ──
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        border: "1px solid var(--ant-color-primary, #4db6ac)",
        borderRadius: 8,
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 16, lineHeight: 1 }}>
        <HolderOutlined />
      </span>
      <Input
        style={{ width: "30%" }}
        value={label}
        status={!label.trim() ? "error" : undefined}
        placeholder="Label"
        onChange={(e) => setLabel(e.target.value)}
        onPressEnter={save}
      />
      <Input
        style={{ flex: 1 }}
        value={href}
        status={!href.trim() ? "error" : undefined}
        placeholder="/link"
        onChange={(e) => setHref(e.target.value)}
        onPressEnter={save}
      />
      <Switch
        size="small"
        checked={active}
        onChange={setActive}
        checkedChildren="On"
        unCheckedChildren="Off"
      />
      <Button type="primary" icon={<SaveOutlined />} disabled={invalid} loading={saving} onClick={save}>
        Save
      </Button>
      <Button icon={<CloseOutlined />} onClick={cancel} disabled={saving}>
        Cancel
      </Button>
    </div>
  )
}

/* ─── Add item row ──────────────────────────────────── */

function AddItemRow({
  menuId,
  nextOrder,
  onAdded,
}: {
  menuId: string
  nextOrder: number
  onAdded: () => void
}) {
  const [label, setLabel] = useState("")
  const [href, setHref] = useState("")
  const { mutate: create, isLoading } = useCreate()

  const invalid = !label.trim() || !href.trim()

  const add = () => {
    if (invalid) {
      message.error("Label and link are required")
      return
    }
    create(
      {
        resource: "cms_menu_items",
        values: {
          menu_id: menuId,
          label: label.trim(),
          href: href.trim(),
          sort_order: nextOrder,
          is_active: true,
        },
      },
      {
        onSuccess: () => {
          setLabel("")
          setHref("")
          message.success("Item added")
          onAdded()
        },
        onError: () => message.error("Failed to add item"),
      }
    )
  }

  return (
    <Space.Compact style={{ width: "100%" }}>
      <Input
        style={{ width: "38%" }}
        value={label}
        placeholder="New item label"
        onChange={(e) => setLabel(e.target.value)}
        onPressEnter={add}
      />
      <Input
        style={{ width: "47%" }}
        value={href}
        placeholder="/link"
        onChange={(e) => setHref(e.target.value)}
        onPressEnter={add}
      />
      <Button type="primary" icon={<PlusOutlined />} loading={isLoading} disabled={invalid} onClick={add}>
        Add
      </Button>
    </Space.Compact>
  )
}
