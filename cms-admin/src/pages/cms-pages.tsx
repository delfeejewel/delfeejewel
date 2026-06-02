import { useList, useCreate, useUpdate, useDelete, useInvalidate } from "@refinedev/core"
import {
  Card,
  Button,
  Typography,
  Tag,
  Space,
  Spin,
  Form,
  Input,
  Select,
  Switch,
  Popconfirm,
  message,
} from "antd"
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  SaveOutlined,
  FileTextOutlined,
} from "@ant-design/icons"
import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { AboutSections, AboutTemplateEditor, aboutInitialValues, aboutContentJson } from "./cms-page-about"
import { PolicySections, PolicyTemplateEditor, policyInitialValues, policyContentJson } from "./cms-page-policy"
import { AuthenticitySections, AuthenticityTemplateEditor, authInitialValues, authContentJson } from "./cms-page-authenticity"
import { TEMPLATE_OPTIONS, templateLabel, ABOUT_TEMPLATE, POLICY_TEMPLATE, AUTHENTICITY_TEMPLATE, CODED_TEMPLATE } from "./page-templates"
import { useIsDeveloper } from "../hooks/use-role"

const { Title, Text } = Typography

const SLUG_RULES = [
  { required: true, message: "Slug is required" },
  { pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: "Lowercase letters, numbers and hyphens only" },
]

/* ─── List ──────────────────────────────────────────── */

export const PageList = () => {
  const navigate = useNavigate()
  const { data, isLoading } = useList({
    resource: "cms_pages",
    sorters: [{ field: "title", order: "asc" }],
    pagination: { pageSize: 100 },
  })
  const { mutate: remove } = useDelete()
  const invalidate = useInvalidate()

  const pages: any[] = data?.data || []

  const handleDelete = (id: string, title: string) => {
    remove(
      { resource: "cms_pages", id },
      {
        onSuccess: () => {
          message.success(`"${title}" deleted`)
          invalidate({ resource: "cms_pages", invalidates: ["list"] })
        },
        onError: () => message.error("Failed to delete"),
      }
    )
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Pages</Title>
          <Text type="secondary">
            {isLoading ? "Loading…" : `${pages.length} page${pages.length !== 1 ? "s" : ""}`}
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/pages/create")}>
          Add Page
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <Spin tip="Loading…"><div style={{ minHeight: 120 }} /></Spin>
        ) : pages.length === 0 ? (
          <Text type="secondary" style={{ display: "block", padding: "24px 0", textAlign: "center", fontStyle: "italic" }}>
            No pages yet. Click Add Page to create one.
          </Text>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {pages.map((page, i) => (
              <div
                key={page.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 4px",
                  borderBottom: i < pages.length - 1 ? "1px solid rgba(255,255,255,0.06)" : undefined,
                }}
              >
                <FileTextOutlined style={{ color: "rgba(255,255,255,0.25)", fontSize: 16, flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text strong style={{ fontSize: 14, display: "block" }}>{page.title}</Text>
                  <Text type="secondary" style={{ fontSize: 12, fontFamily: "monospace" }}>/{page.slug}</Text>
                </div>

                <Space size={10}>
                  <Tag style={{ margin: 0 }}>{templateLabel(page.template)}</Tag>
                  <Tag color={page.is_published ? "green" : undefined} style={{ margin: 0 }}>
                    {page.is_published ? "Published" : "Draft"}
                  </Tag>
                  <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/pages/edit/${page.id}`)}>
                    Edit
                  </Button>
                  <Popconfirm title={`Delete "${page.title}"?`} onConfirm={() => handleDelete(page.id, page.title)}>
                    <Button size="small" icon={<DeleteOutlined />} danger />
                  </Popconfirm>
                </Space>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

/* ─── Shared editor form (create + edit) ─────────────── */

function PageEditorForm({ record, onSaved }: { record?: any; onSaved: () => void }) {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const isEdit = !!record

  const { mutate: create, isLoading: creating } = useCreate()
  const { mutate: update, isLoading: updating } = useUpdate()
  const saving = creating || updating

  const [dirty, setDirty] = useState(!isEdit)
  const template = Form.useWatch("template", form) || "standard"
  const isCoded = template === CODED_TEMPLATE
  const isDeveloper = useIsDeveloper()

  // A developer can promote a coded page to an editable template (the "Coded
  // Layout" option stays in the list so the current value still shows). Everyone
  // else just sees the current template, read-only.
  const codedOption = { value: CODED_TEMPLATE, label: templateLabel(CODED_TEMPLATE) }
  const templateOptions = isCoded
    ? isDeveloper
      ? [codedOption, ...TEMPLATE_OPTIONS]
      : [codedOption]
    : TEMPLATE_OPTIONS

  const initialValues = useMemo(() => {
    if (!record) return { template: "standard", is_published: false }
    const base = {
      template: record.template || "standard",
      title: record.title,
      slug: record.slug,
      content: record.content,
      meta_title: record.meta_title,
      meta_description: record.meta_description,
      is_published: record.is_published,
    }
    if ((record.template || "") === ABOUT_TEMPLATE) return { ...base, ...aboutInitialValues(record.content_json) }
    if ((record.template || "") === POLICY_TEMPLATE) return { ...base, ...policyInitialValues(record.content_json) }
    if ((record.template || "") === AUTHENTICITY_TEMPLATE) return { ...base, ...authInitialValues(record.content_json) }
    return base
  }, [record])

  // Switching to a structured template on a page without section data yet seeds
  // starter content so the Form.List sections render with rows.
  useEffect(() => {
    if (template === ABOUT_TEMPLATE && !form.getFieldValue("hero")) {
      form.setFieldsValue(aboutInitialValues(undefined))
    }
    if (template === POLICY_TEMPLATE && !form.getFieldValue("sections")) {
      form.setFieldsValue(policyInitialValues(undefined))
    }
    if (template === AUTHENTICITY_TEMPLATE && !form.getFieldValue("pillars")) {
      form.setFieldsValue(authInitialValues(undefined))
    }
  }, [template, form])

  const handleSave = (values: any) => {
    const base = {
      template: values.template,
      title: values.title,
      slug: values.slug,
      meta_title: values.meta_title ?? null,
      meta_description: values.meta_description ?? null,
      is_published: !!values.is_published,
    }
    let payload: any
    if (values.template === ABOUT_TEMPLATE) {
      payload = { ...base, content: null, content_json: aboutContentJson(values) }
    } else if (values.template === POLICY_TEMPLATE) {
      payload = { ...base, content: null, content_json: policyContentJson(values) }
    } else if (values.template === AUTHENTICITY_TEMPLATE) {
      payload = { ...base, content: null, content_json: authContentJson(values) }
    } else {
      payload = { ...base, content: values.content ?? null, content_json: null }
    }

    const onSuccess = () => {
      message.success(isEdit ? "Page saved" : "Page created")
      onSaved()
    }
    if (isEdit) {
      update({ resource: "cms_pages", id: record.id, values: payload }, { onSuccess, onError: () => message.error("Failed to save") })
    } else {
      create({ resource: "cms_pages", values: payload }, { onSuccess, onError: () => message.error("Failed to create page") })
    }
  }

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onValuesChange={() => setDirty(true)}
      onFinish={handleSave}
    >
      {/* Page setup — includes SEO & visibility */}
      <Card title="Page Setup" size="small" style={{ marginBottom: 16 }}>
        <Form.Item
          label="Template"
          name="template"
          rules={[{ required: true, message: "Choose a template" }]}
          extra={
            isCoded
              ? isDeveloper
                ? "This page's layout is currently built into the storefront. Switch to an editable template to manage its content from the CMS."
                : "This page's layout is built into the storefront. An editable template will be added later."
              : isDeveloper
              ? "Determines how this page is built and rendered."
              : "Template can only be changed by a developer."
          }
        >
          <Select options={templateOptions} disabled={!isDeveloper} />
        </Form.Item>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Form.Item label="Title" name="title" rules={[{ required: true, message: "Title is required" }]} style={{ marginBottom: 12 }}>
            <Input placeholder="About Us" />
          </Form.Item>
          <Form.Item label="Slug" name="slug" rules={SLUG_RULES} extra="URL path, e.g. about-us" style={{ marginBottom: 12 }}>
            <Input addonBefore="/" disabled={isEdit} placeholder="about-us" />
          </Form.Item>
        </div>
        <Form.Item label="Meta Title" name="meta_title" extra="Defaults to the page title if left blank." style={{ marginBottom: 12 }}>
          <Input placeholder="About Us — Your Store" />
        </Form.Item>
        <Form.Item label="Meta Description" name="meta_description" style={{ marginBottom: 12 }}>
          <Input.TextArea rows={2} placeholder="A short description for search engines (under 160 characters)." />
        </Form.Item>
        <Form.Item label="Published" name="is_published" valuePropName="checked" style={{ marginBottom: 0 }}>
          <Switch checkedChildren="Published" unCheckedChildren="Draft" />
        </Form.Item>
      </Card>

      {/* Template body */}
      {isCoded ? (
        <Card title="Content" size="small" style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ display: "block", lineHeight: 1.6 }}>
            This page's content and layout are currently built into the storefront code.
            You can manage its title, SEO and visibility here — an editable content
            template will be added for this page later.
          </Text>
        </Card>
      ) : template === ABOUT_TEMPLATE ? (
        <AboutSections />
      ) : template === POLICY_TEMPLATE ? (
        <PolicySections />
      ) : template === AUTHENTICITY_TEMPLATE ? (
        <AuthenticitySections />
      ) : (
        <Card title="Content" size="small" style={{ marginBottom: 16 }}>
          <Form.Item label="Content (HTML)" name="content" style={{ marginBottom: 0 }}>
            <Input.TextArea
              rows={14}
              placeholder="<p>Page content goes here…</p>"
              style={{ fontFamily: "monospace", fontSize: 13 }}
            />
          </Form.Item>
        </Card>
      )}

      <Space>
        <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />} disabled={isEdit && !dirty}>
          {isEdit ? "Save" : "Create Page"}
        </Button>
        <Button onClick={() => navigate("/pages")} disabled={saving}>Cancel</Button>
      </Space>
    </Form>
  )
}

/* ─── Create ─────────────────────────────────────────── */

export const PageCreate = () => {
  const navigate = useNavigate()
  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/pages")} />
        <Title level={3} style={{ margin: 0 }}>Add Page</Title>
      </div>
      <PageEditorForm onSaved={() => navigate("/pages")} />
    </div>
  )
}

/* ─── Edit ───────────────────────────────────────────── */

export const PageEdit = () => {
  const navigate = useNavigate()
  const { id = "" } = useParams()

  const { data, isLoading } = useList({
    resource: "cms_pages",
    filters: [{ field: "id", operator: "eq", value: id }],
    pagination: { pageSize: 1 },
    queryOptions: { enabled: !!id },
  })

  const record = data?.data?.[0] as any

  if (isLoading || !record) {
    return <Spin tip="Loading…"><div style={{ minHeight: 200 }} /></Spin>
  }

  // Structured templates use their own section-wise editors.
  if (record.template === ABOUT_TEMPLATE) {
    return <AboutTemplateEditor record={record} />
  }
  if (record.template === POLICY_TEMPLATE) {
    return <PolicyTemplateEditor record={record} />
  }
  if (record.template === AUTHENTICITY_TEMPLATE) {
    return <AuthenticityTemplateEditor record={record} />
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/pages")} />
        <Title level={3} style={{ margin: 0 }}>Edit Page</Title>
        <Tag color={record.is_published ? "green" : undefined} style={{ marginLeft: 4 }}>
          {record.is_published ? "Published" : "Draft"}
        </Tag>
      </div>
      <PageEditorForm record={record} onSaved={() => navigate("/pages")} />
    </div>
  )
}
