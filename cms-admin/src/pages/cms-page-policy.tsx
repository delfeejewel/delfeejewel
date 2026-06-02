import { useUpdate, useInvalidate } from "@refinedev/core"
import { Card, Form, Input, Button, Switch, Space, Tag, Select, Typography, message } from "antd"
import { PlusOutlined, MinusCircleOutlined, ArrowLeftOutlined } from "@ant-design/icons"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { EditableCard, ReadRow, muted, useCollapse, SectionChips } from "./cms-page-about"
import { POLICY_TEMPLATE, TEMPLATE_OPTIONS, templateLabel } from "./page-templates"
import { useIsDeveloper } from "../hooks/use-role"

const { Title, Text } = Typography

export { POLICY_TEMPLATE }

const POLICY_DEFAULTS = {
  eyebrow: "Legal",
  intro: "",
  lastUpdated: "",
  sections: [{ heading: "", body: "" }],
}

function safeParse(s: string) {
  try { return JSON.parse(s) } catch { return {} }
}

export function policyInitialValues(cj: any) {
  const c = (typeof cj === "string" ? safeParse(cj) : cj) || {}
  return {
    eyebrow: c.eyebrow ?? POLICY_DEFAULTS.eyebrow,
    intro: c.intro ?? "",
    lastUpdated: c.lastUpdated ?? "",
    sections: c.sections?.length ? c.sections : POLICY_DEFAULTS.sections,
  }
}

export function policyContentJson(values: any) {
  return {
    eyebrow: values.eyebrow,
    intro: values.intro,
    lastUpdated: values.lastUpdated,
    sections: values.sections,
  }
}

/* ─── Field groups ─── */

const DetailsFields = () => (
  <>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Form.Item label="Eyebrow" name="eyebrow" style={{ marginBottom: 12 }} extra="Small label above the title (e.g. Legal).">
        <Input placeholder="Legal" />
      </Form.Item>
      <Form.Item label="Last Updated" name="lastUpdated" style={{ marginBottom: 12 }}>
        <Input placeholder="22 May 2026" />
      </Form.Item>
    </div>
    <Form.Item label="Intro" name="intro" style={{ marginBottom: 0 }} extra="Short paragraph shown under the title.">
      <Input.TextArea rows={2} />
    </Form.Item>
  </>
)

// The list of sections — heading becomes the left-nav item, body is the content.
const SectionsFields = () => (
  <Form.List name="sections">
    {(fields, { add, remove }) => (
      <div>
        {fields.map(({ key, name, ...rest }) => (
          <div
            key={key}
            style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 12, marginBottom: 12 }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Form.Item
                {...rest}
                name={[name, "heading"]}
                label="Section Title (nav)"
                style={{ flex: 1, marginBottom: 8 }}
                rules={[{ required: true, message: "Section title is required" }]}
              >
                <Input placeholder="e.g. Return Eligibility" />
              </Form.Item>
              <Button
                type="text"
                danger
                icon={<MinusCircleOutlined />}
                onClick={() => remove(name)}
                style={{ marginTop: 30 }}
              />
            </div>
            <Form.Item
              {...rest}
              name={[name, "body"]}
              label="Content (HTML)"
              style={{ marginBottom: 0 }}
            >
              <Input.TextArea
                rows={5}
                placeholder="<p>Section content…</p>  •  use <ul><li> for lists, <a href> for links"
                style={{ fontFamily: "monospace", fontSize: 12 }}
              />
            </Form.Item>
          </div>
        ))}
        <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ heading: "", body: "" })} block>
          Add section
        </Button>
      </div>
    )}
  </Form.List>
)

/**
 * Policy-template section block for the create form (binds to surrounding Form).
 */
export function PolicySections() {
  return (
    <>
      <Card title="Details" size="small" style={{ marginBottom: 16 }}>
        <DetailsFields />
      </Card>
      <Card title="Sections" size="small" style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 12 }}>
          Section titles appear in the left-hand navigation; content shows on the right.
        </Text>
        <SectionsFields />
      </Card>
    </>
  )
}

/* ─── Section-wise editor ─── */

export function PolicyTemplateEditor({ record }: { record: any }) {
  const navigate = useNavigate()
  const invalidate = useInvalidate()
  const { mutate: update, isLoading: saving } = useUpdate()
  const isDeveloper = useIsDeveloper()

  const [content, setContent] = useState<any>(() => policyInitialValues(record.content_json))
  const [meta, setMeta] = useState({
    title: record.title || "",
    slug: record.slug || "",
    template: record.template || POLICY_TEMPLATE,
    meta_title: record.meta_title || "",
    meta_description: record.meta_description || "",
    is_published: !!record.is_published,
  })

  const persist = (nextContent: any, nextMeta: typeof meta, done: () => void) => {
    update(
      {
        resource: "cms_pages",
        id: record.id,
        values: {
          template: nextMeta.template,
          content: null,
          content_json: nextContent,
          title: nextMeta.title,
          meta_title: nextMeta.meta_title || null,
          meta_description: nextMeta.meta_description || null,
          is_published: nextMeta.is_published,
        },
      },
      {
        onSuccess: () => {
          setContent(nextContent)
          setMeta(nextMeta)
          message.success("Saved")
          invalidate({ resource: "cms_pages", invalidates: ["list"] })
          done()
        },
        onError: () => message.error("Failed to save"),
      }
    )
  }

  const { collapsed, toggle } = useCollapse()

  const SECTION_CHIPS = [
    { key: "setup", label: "Page Setup" },
    { key: "details", label: "Details" },
    { key: "sections", label: "Sections" },
  ]

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/pages")} />
        <Title level={3} style={{ margin: 0 }}>Edit Sectioned Page</Title>
        <Tag color={meta.is_published ? "green" : undefined} style={{ marginLeft: 4 }}>
          {meta.is_published ? "Published" : "Draft"}
        </Tag>
      </div>

      <SectionChips sections={SECTION_CHIPS} collapsed={collapsed} onToggle={toggle} />

      {/* Page setup — title + SEO + visibility; slug & template read-only */}
      <EditableCard
        title="Page Setup"
        collapsed={collapsed["setup"]}
        onToggleCollapse={() => toggle("setup")}
        value={{ title: meta.title, template: meta.template, meta_title: meta.meta_title, meta_description: meta.meta_description, is_published: meta.is_published }}
        saving={saving}
        onSave={(v, done) =>
          persist(content, { ...meta, ...v }, () => {
            if (v.template && v.template !== meta.template) navigate("/pages")
            else done()
          })
        }
        read={
          <>
            <ReadRow label="Title"><Text strong>{meta.title || muted}</Text></ReadRow>
            <ReadRow label="Slug"><Text code>/{meta.slug}</Text></ReadRow>
            <ReadRow label="Template"><Tag>{templateLabel(meta.template)}</Tag></ReadRow>
            <ReadRow label="Meta Title">{meta.meta_title || muted}</ReadRow>
            <ReadRow label="Meta Description">{meta.meta_description || muted}</ReadRow>
            <ReadRow label="Published">
              <Tag color={meta.is_published ? "green" : undefined}>{meta.is_published ? "Published" : "Draft"}</Tag>
            </ReadRow>
          </>
        }
      >
        <Form.Item label="Title" name="title" rules={[{ required: true, message: "Title is required" }]} style={{ marginBottom: 12 }}>
          <Input placeholder="Privacy Policy" />
        </Form.Item>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Form.Item label="Slug" style={{ marginBottom: 12 }}>
            <Input addonBefore="/" value={meta.slug} disabled />
          </Form.Item>
          {isDeveloper ? (
            <Form.Item label="Template" name="template" rules={[{ required: true }]} extra="Developer only" style={{ marginBottom: 12 }}>
              <Select options={TEMPLATE_OPTIONS} />
            </Form.Item>
          ) : (
            <Form.Item label="Template" style={{ marginBottom: 12 }}>
              <Input value={templateLabel(meta.template)} disabled />
            </Form.Item>
          )}
        </div>
        <Form.Item label="Meta Title" name="meta_title" extra="Defaults to the page title if left blank." style={{ marginBottom: 12 }}>
          <Input />
        </Form.Item>
        <Form.Item label="Meta Description" name="meta_description" style={{ marginBottom: 12 }}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item label="Published" name="is_published" valuePropName="checked" style={{ marginBottom: 0 }}>
          <Switch checkedChildren="Published" unCheckedChildren="Draft" />
        </Form.Item>
      </EditableCard>

      {/* Details */}
      <EditableCard
        title="Details"
        collapsed={collapsed["details"]}
        onToggleCollapse={() => toggle("details")}
        value={{ eyebrow: content.eyebrow, intro: content.intro, lastUpdated: content.lastUpdated }}
        saving={saving}
        onSave={(v, done) => persist({ ...content, ...v }, meta, done)}
        read={
          <>
            <ReadRow label="Eyebrow">{content.eyebrow || muted}</ReadRow>
            <ReadRow label="Intro">{content.intro || muted}</ReadRow>
            <ReadRow label="Last Updated">{content.lastUpdated || muted}</ReadRow>
          </>
        }
      >
        <DetailsFields />
      </EditableCard>

      {/* Sections */}
      <EditableCard
        title="Sections"
        collapsed={collapsed["sections"]}
        onToggleCollapse={() => toggle("sections")}
        tag={<Tag style={{ margin: 0 }}>{content.sections?.length || 0}</Tag>}
        value={{ sections: content.sections }}
        saving={saving}
        onSave={(v, done) => persist({ ...content, sections: v.sections }, meta, done)}
        read={
          content.sections?.length ? (
            <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
              {content.sections.map((s: any, i: number) => (
                <li key={i} style={{ fontSize: 13 }}>
                  <Text strong>{s.heading || <Text type="secondary" italic>Untitled</Text>}</Text>
                </li>
              ))}
            </ol>
          ) : muted
        }
      >
        <SectionsFields />
      </EditableCard>
    </div>
  )
}
