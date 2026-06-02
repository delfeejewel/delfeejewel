import { useUpdate, useInvalidate } from "@refinedev/core"
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Switch,
  Tag,
  Select,
  message,
  Row,
  Col,
} from "antd"
import {
  PlusOutlined,
  MinusCircleOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons"
import { useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { icons as lucideIcons, type LucideIcon } from "lucide-react"
import { IconPicker } from "../components/icon-picker"
import { EditableCard, ReadRow, muted } from "./cms-page-about"
import { AUTHENTICITY_TEMPLATE, TEMPLATE_OPTIONS, templateLabel } from "./page-templates"
import { useIsDeveloper } from "../hooks/use-role"

const { Title, Text } = Typography

export { AUTHENTICITY_TEMPLATE }

/* ─── Small shared helpers ─── */

const req = (label: string) => [{ required: true, message: `${label} is required` }]

const stripHtml = (html?: string) =>
  (html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()

const toPascalCase = (s: string) =>
  s.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("")

const LucideGlyph = ({ name }: { name?: string }) => {
  if (!name) return null
  const Icon = (lucideIcons as Record<string, LucideIcon>)[toPascalCase(name)]
  return Icon ? <Icon size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} /> : null
}

const SectionHeading = ({ children }: { children: ReactNode }) => (
  <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block" }}>
    {children}
  </Text>
)

const CTA_TARGET_OPTIONS = [
  { value: "_self", label: "Same tab" },
  { value: "_blank", label: "New tab" },
]
const ctaTargetLabel = (t?: string) => CTA_TARGET_OPTIONS.find((o) => o.value === t)?.label ?? t

function safeParse(s: string) {
  try { return JSON.parse(s) } catch { return {} }
}

/* ─── Defaults (mirror the original hardcoded storefront page) ─── */

export const AUTH_DEFAULTS = {
  hero: {
    eyebrow: "Trust & Purity",
    title: "Authenticity & Hallmarking",
    description: "When you buy from us, you buy genuine silver — certified, hallmarked and made to be trusted. Here's our promise on purity.",
  },
  intro: {
    icon: "badge-check",
    heading: 'What does "925" mean?',
    body:
      "Pure silver is too soft for everyday jewellery, so it's combined with a small amount of other metals for durability. " +
      'Sterling silver is 92.5% pure silver — which is why it carries the "925" stamp. ' +
      "It's the trusted global standard for fine silver jewellery you can wear every day.",
  },
  pillars: {
    eyebrow: "Our guarantee",
    heading: "Certified at every step",
    items: [
      { icon: "gem", title: "925 Sterling Silver", text: "Our jewellery is 92.5% pure silver alloyed for strength — the international standard for fine silver." },
      { icon: "shield-check", title: "BIS Hallmarked", text: "Pieces are hallmarked by the Bureau of Indian Standards, independently certifying their purity." },
      { icon: "scroll-text", title: "Certificate of Authenticity", text: "Eligible orders include documentation confirming the metal and craftsmanship of your piece." },
      { icon: "award", title: "Responsibly Sourced", text: "We work with trusted suppliers and ethical practices from raw metal to finished jewellery." },
    ],
  },
  marks: {
    eyebrow: "How to read a hallmark",
    heading: "What to look for",
    description: "A genuine BIS hallmark on silver carries a set of tiny stamps. Together, they confirm your jewellery is the real thing.",
    items: [
      { title: "BIS Standard Mark", text: "The official triangular BIS logo — the foundation of a genuine hallmark." },
      { title: "Purity Grade", text: 'The fineness stamp, such as "925", confirming 92.5% silver purity.' },
      { title: "Assaying Centre Mark", text: "Identifies the BIS-recognised centre that tested and certified the piece." },
      { title: "Jeweller's Identification", text: "A unique mark linking the piece back to its responsible jeweller." },
    ],
  },
  promise: {
    icon: "shield-check",
    heading: "Our promise to you",
    body: "If any piece you receive from us does not meet the purity we promise, we will make it right — with a replacement or a full refund. Genuine silver, every single time.",
    buttonLabel: "Shop Certified Silver",
    buttonHref: "/store",
    buttonTarget: "_self",
  },
}

// Sections that can be shown/hidden on the storefront.
const AUTH_SECTION_KEYS = ["hero", "intro", "pillars", "marks", "promise"] as const

function resolveVisibility(v: any): Record<string, boolean> {
  return AUTH_SECTION_KEYS.reduce((acc, k) => {
    acc[k] = v?.[k] !== false
    return acc
  }, {} as Record<string, boolean>)
}

export function authInitialValues(cj: any) {
  const c = (typeof cj === "string" ? safeParse(cj) : cj) || {}
  return {
    hero: { ...AUTH_DEFAULTS.hero, ...(c.hero || {}) },
    intro: { ...AUTH_DEFAULTS.intro, ...(c.intro || {}) },
    pillars: {
      ...AUTH_DEFAULTS.pillars,
      ...(c.pillars || {}),
      items: c.pillars?.items?.length ? c.pillars.items : AUTH_DEFAULTS.pillars.items,
    },
    marks: {
      ...AUTH_DEFAULTS.marks,
      ...(c.marks || {}),
      items: c.marks?.items?.length ? c.marks.items : AUTH_DEFAULTS.marks.items,
    },
    promise: { ...AUTH_DEFAULTS.promise, ...(c.promise || {}) },
    visibility: resolveVisibility(c.visibility),
  }
}

export function authContentJson(values: any) {
  return {
    hero: values.hero,
    intro: values.intro,
    pillars: values.pillars,
    marks: values.marks,
    promise: values.promise,
    visibility: resolveVisibility(values.visibility),
  }
}

/* ─── A reusable item list (pillars: icon+title+text, marks: title+text) ─── */

const ItemListFields = ({
  name = "items",
  withIcon = false,
  maxItems,
  addLabel = "Add item",
}: {
  name?: any
  withIcon?: boolean
  maxItems?: number
  addLabel?: string
}) => (
  <Form.List
    name={name}
    rules={maxItems ? [{ validator: (_, items: any) => (items?.length ? Promise.resolve() : Promise.reject(new Error("Add at least one"))) }] : undefined}
  >
    {(fields, { add, remove }, { errors }) => (
      <>
        {fields.map(({ key, name: fieldName, ...rest }) =>
          withIcon ? (
            <div key={key} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Form.Item {...rest} name={[fieldName, "icon"]} label="Icon" rules={[{ required: true, message: "Icon is required" }]} style={{ marginBottom: 0 }}>
                  <IconPicker />
                </Form.Item>
                <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(fieldName)} disabled={!!maxItems && fields.length <= 1} />
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <Form.Item {...rest} name={[fieldName, "title"]} label="Heading" style={{ width: 220, marginBottom: 0 }} rules={[{ required: true, message: "Heading is required" }]}>
                  <Input />
                </Form.Item>
                <Form.Item {...rest} name={[fieldName, "text"]} label="Description" style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, message: "Description is required" }]}>
                  <Input.TextArea rows={2} />
                </Form.Item>
              </div>
            </div>
          ) : (
            <div key={key} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-end" }}>
              <Form.Item {...rest} name={[fieldName, "title"]} label="Heading" style={{ width: 220, marginBottom: 0 }} rules={[{ required: true, message: "Heading is required" }]}>
                <Input />
              </Form.Item>
              <Form.Item {...rest} name={[fieldName, "text"]} label="Description" style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, message: "Description is required" }]}>
                <Input.TextArea rows={2} />
              </Form.Item>
              <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(fieldName)} disabled={!!maxItems && fields.length <= 1} />
            </div>
          )
        )}
        {(!maxItems || fields.length < maxItems) && (
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => add(withIcon ? { icon: "", title: "", text: "" } : { title: "", text: "" })} block>{addLabel}</Button>
        )}
        {maxItems && <Form.ErrorList errors={errors} />}
      </>
    )}
  </Form.List>
)

/* ─── Edit-mode field groups (relative names, for EditableCard forms) ─── */

const HeroFields = () => (
  <>
    <Form.Item label="Eyebrow" name="eyebrow" rules={req("Eyebrow")} style={{ marginBottom: 12 }}><Input /></Form.Item>
    <Form.Item label="Title" name="title" rules={req("Title")} style={{ marginBottom: 12 }}><Input /></Form.Item>
    <Form.Item label="Description" name="description" rules={req("Description")} style={{ marginBottom: 0 }}><Input.TextArea rows={3} /></Form.Item>
  </>
)

const IntroFields = () => (
  <>
    <Form.Item label="Icon" name="icon" rules={req("Icon")} style={{ marginBottom: 12 }}><IconPicker /></Form.Item>
    <Form.Item label="Heading" name="heading" rules={req("Heading")} style={{ marginBottom: 12 }}><Input /></Form.Item>
    <Form.Item label="Body" name="body" rules={req("Body")} style={{ marginBottom: 0 }}><Input.TextArea rows={4} placeholder="Explain…" /></Form.Item>
  </>
)

const PillarsFields = () => (
  <>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Form.Item label="Eyebrow" name="eyebrow" style={{ marginBottom: 12 }}><Input /></Form.Item>
      <Form.Item label="Heading" name="heading" rules={req("Heading")} style={{ marginBottom: 12 }}><Input /></Form.Item>
    </div>
    <SectionHeading>Pillars (pick an icon for each)</SectionHeading>
    <ItemListFields withIcon maxItems={4} addLabel="Add pillar" />
  </>
)

const MarksFields = () => (
  <>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Form.Item label="Eyebrow" name="eyebrow" style={{ marginBottom: 12 }}><Input /></Form.Item>
      <Form.Item label="Heading" name="heading" rules={req("Heading")} style={{ marginBottom: 12 }}><Input /></Form.Item>
    </div>
    <Form.Item label="Description" name="description" style={{ marginBottom: 12 }}><Input.TextArea rows={2} /></Form.Item>
    <SectionHeading>Marks (numbered automatically)</SectionHeading>
    <ItemListFields maxItems={4} addLabel="Add mark" />
  </>
)

const PromiseFields = () => (
  <>
    <Form.Item label="Icon" name="icon" rules={req("Icon")} style={{ marginBottom: 12 }}><IconPicker /></Form.Item>
    <Form.Item label="Heading" name="heading" rules={req("Heading")} style={{ marginBottom: 12 }}><Input /></Form.Item>
    <Form.Item label="Body" name="body" rules={req("Body")} style={{ marginBottom: 12 }}><Input.TextArea rows={4} placeholder="Your promise…" /></Form.Item>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Form.Item label="Button Label" name="buttonLabel" rules={req("Button label")} style={{ marginBottom: 12 }}><Input /></Form.Item>
      <Form.Item label="Button Link" name="buttonHref" rules={req("Button link")} style={{ marginBottom: 12 }}><Input /></Form.Item>
    </div>
    <Form.Item label="Open Link In" name="buttonTarget" rules={req("Target")} style={{ marginBottom: 0 }}><Select options={CTA_TARGET_OPTIONS} /></Form.Item>
  </>
)

/* ─── Read-only views ─── */

const HeroRead = ({ v }: { v: any }) => (
  <>
    <ReadRow label="Eyebrow">{v.eyebrow || muted}</ReadRow>
    <ReadRow label="Title"><Text strong>{v.title || muted}</Text></ReadRow>
    <ReadRow label="Description">{v.description || muted}</ReadRow>
  </>
)

const IntroRead = ({ v }: { v: any }) => {
  const p = stripHtml(v.body)
  return (
    <>
      <ReadRow label="Icon">{v.icon ? <Text><LucideGlyph name={v.icon} />{v.icon}</Text> : muted}</ReadRow>
      <ReadRow label="Heading"><Text strong>{v.heading || muted}</Text></ReadRow>
      <ReadRow label="Body">{p ? <Text>{p.length > 200 ? p.slice(0, 200) + "…" : p}</Text> : muted}</ReadRow>
    </>
  )
}

const ListRead = ({ v, items, withIcon }: { v: any; items: any[]; withIcon?: boolean }) => (
  <>
    <ReadRow label="Eyebrow">{v.eyebrow || muted}</ReadRow>
    <ReadRow label="Heading"><Text strong>{v.heading || muted}</Text></ReadRow>
    {v.description !== undefined && <ReadRow label="Description">{v.description || muted}</ReadRow>}
    <ReadRow label="Items">
      {items?.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((it, i) => (
            <div key={i}><Text>{withIcon && it.icon ? <LucideGlyph name={it.icon} /> : `${i + 1}. `}{it.title}</Text></div>
          ))}
        </div>
      ) : muted}
    </ReadRow>
  </>
)

const PromiseRead = ({ v }: { v: any }) => {
  const p = stripHtml(v.body)
  return (
    <>
      <ReadRow label="Icon">{v.icon ? <Text><LucideGlyph name={v.icon} />{v.icon}</Text> : muted}</ReadRow>
      <ReadRow label="Heading"><Text strong>{v.heading || muted}</Text></ReadRow>
      <ReadRow label="Body">{p ? <Text>{p.length > 160 ? p.slice(0, 160) + "…" : p}</Text> : muted}</ReadRow>
      <ReadRow label="Button">
        {v.buttonLabel
          ? <Text>{v.buttonLabel} → <Text code>{v.buttonHref}</Text> ({ctaTargetLabel(v.buttonTarget)})</Text>
          : muted}
      </ReadRow>
    </>
  )
}

/* ─── Create-flow sections (flat form, prefixed names) ─── */

export function AuthenticitySections() {
  return (
    <>
      <Card title="Hero" size="small" style={{ marginBottom: 16 }}>
        <Form.Item label="Eyebrow" name={["hero", "eyebrow"]} rules={req("Eyebrow")} style={{ marginBottom: 12 }}><Input /></Form.Item>
        <Form.Item label="Title" name={["hero", "title"]} rules={req("Title")} style={{ marginBottom: 12 }}><Input /></Form.Item>
        <Form.Item label="Description" name={["hero", "description"]} rules={req("Description")} style={{ marginBottom: 0 }}><Input.TextArea rows={3} /></Form.Item>
      </Card>

      <Card title="Intro" size="small" style={{ marginBottom: 16 }}>
        <Form.Item label="Icon" name={["intro", "icon"]} rules={req("Icon")} style={{ marginBottom: 12 }}><IconPicker /></Form.Item>
        <Form.Item label="Heading" name={["intro", "heading"]} rules={req("Heading")} style={{ marginBottom: 12 }}><Input /></Form.Item>
        <Form.Item label="Body" name={["intro", "body"]} rules={req("Body")} style={{ marginBottom: 0 }}><Input.TextArea rows={4} placeholder="Explain…" /></Form.Item>
      </Card>

      <Card title="Pillars" size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Form.Item label="Eyebrow" name={["pillars", "eyebrow"]} style={{ marginBottom: 12 }}><Input /></Form.Item>
          <Form.Item label="Heading" name={["pillars", "heading"]} rules={req("Heading")} style={{ marginBottom: 12 }}><Input /></Form.Item>
        </div>
        <SectionHeading>Pillars (pick an icon for each)</SectionHeading>
        <ItemListFields name={["pillars", "items"]} withIcon maxItems={4} addLabel="Add pillar" />
      </Card>

      <Card title="Hallmark Marks" size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Form.Item label="Eyebrow" name={["marks", "eyebrow"]} style={{ marginBottom: 12 }}><Input /></Form.Item>
          <Form.Item label="Heading" name={["marks", "heading"]} rules={req("Heading")} style={{ marginBottom: 12 }}><Input /></Form.Item>
        </div>
        <Form.Item label="Description" name={["marks", "description"]} style={{ marginBottom: 12 }}><Input.TextArea rows={2} /></Form.Item>
        <SectionHeading>Marks (numbered automatically)</SectionHeading>
        <ItemListFields name={["marks", "items"]} maxItems={4} addLabel="Add mark" />
      </Card>

      <Card title="Promise" size="small" style={{ marginBottom: 16 }}>
        <Form.Item label="Icon" name={["promise", "icon"]} rules={req("Icon")} style={{ marginBottom: 12 }}><IconPicker /></Form.Item>
        <Form.Item label="Heading" name={["promise", "heading"]} rules={req("Heading")} style={{ marginBottom: 12 }}><Input /></Form.Item>
        <Form.Item label="Body" name={["promise", "body"]} rules={req("Body")} style={{ marginBottom: 12 }}><Input.TextArea rows={4} placeholder="Your promise…" /></Form.Item>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Form.Item label="Button Label" name={["promise", "buttonLabel"]} rules={req("Button label")} style={{ marginBottom: 12 }}><Input /></Form.Item>
          <Form.Item label="Button Link" name={["promise", "buttonHref"]} rules={req("Button link")} style={{ marginBottom: 12 }}><Input /></Form.Item>
        </div>
        <Form.Item label="Open Link In" name={["promise", "buttonTarget"]} rules={req("Target")} style={{ marginBottom: 0 }}><Select options={CTA_TARGET_OPTIONS} /></Form.Item>
      </Card>
    </>
  )
}

/* ─── Section-wise editor (sticky Page Setup + per-section visibility) ─── */

export function AuthenticityTemplateEditor({ record }: { record: any }) {
  const navigate = useNavigate()
  const invalidate = useInvalidate()
  const { mutate: update, isLoading: saving } = useUpdate()
  const isDeveloper = useIsDeveloper()

  const [content, setContent] = useState<any>(() => authInitialValues(record.content_json))
  const [meta, setMeta] = useState({
    title: record.title || "",
    slug: record.slug || "",
    template: record.template || AUTHENTICITY_TEMPLATE,
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

  const saveSection = (key: string, value: any, done: () => void) =>
    persist({ ...content, [key]: value }, meta, done)

  // Show/hide a section on the storefront. Persists immediately.
  const toggleVisible = (key: string, next: boolean) =>
    persist({ ...content, visibility: { ...content.visibility, [key]: next } }, meta, () => {})

  const vis = content.visibility || {}
  const hiddenTag = <Tag>Hidden</Tag>

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/pages")} />
        <Title level={3} style={{ margin: 0 }}>Edit Authenticity Page</Title>
        <Tag color={meta.is_published ? "green" : undefined} style={{ marginLeft: 4 }}>
          {meta.is_published ? "Published" : "Draft"}
        </Tag>
      </div>

      <Row gutter={20} align="top">
        {/* Main column — content sections. Each card's switch shows/hides it on the storefront. */}
        <Col xs={{ span: 24, order: 2 }} lg={{ span: 16, order: 1 }}>
          <EditableCard title="Hero" tag={vis.hero === false ? hiddenTag : undefined} visible={vis.hero} onToggleVisible={(n) => toggleVisible("hero", n)} value={content.hero} saving={saving} onSave={(v, d) => saveSection("hero", v, d)} read={<HeroRead v={content.hero} />}>
            <HeroFields />
          </EditableCard>

          <EditableCard title="Intro" tag={vis.intro === false ? hiddenTag : undefined} visible={vis.intro} onToggleVisible={(n) => toggleVisible("intro", n)} value={content.intro} saving={saving} onSave={(v, d) => saveSection("intro", v, d)} read={<IntroRead v={content.intro} />}>
            <IntroFields />
          </EditableCard>

          <EditableCard title="Pillars" tag={vis.pillars === false ? hiddenTag : undefined} visible={vis.pillars} onToggleVisible={(n) => toggleVisible("pillars", n)} value={content.pillars} saving={saving} onSave={(v, d) => saveSection("pillars", v, d)} read={<ListRead v={content.pillars} items={content.pillars?.items} withIcon />}>
            <PillarsFields />
          </EditableCard>

          <EditableCard title="Hallmark Marks" tag={vis.marks === false ? hiddenTag : undefined} visible={vis.marks} onToggleVisible={(n) => toggleVisible("marks", n)} value={content.marks} saving={saving} onSave={(v, d) => saveSection("marks", v, d)} read={<ListRead v={content.marks} items={content.marks?.items} />}>
            <MarksFields />
          </EditableCard>

          <EditableCard title="Promise" tag={vis.promise === false ? hiddenTag : undefined} visible={vis.promise} onToggleVisible={(n) => toggleVisible("promise", n)} value={content.promise} saving={saving} onSave={(v, d) => saveSection("promise", v, d)} read={<PromiseRead v={content.promise} />}>
            <PromiseFields />
          </EditableCard>
        </Col>

        {/* Sidebar — page setup, sticky so SEO/visibility stay reachable while editing */}
        <Col xs={{ span: 24, order: 1 }} lg={{ span: 8, order: 2 }}>
          <div style={{ position: "sticky", top: 16 }}>
            <EditableCard
              title="Page Setup"
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
                <Input />
              </Form.Item>
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
          </div>
        </Col>
      </Row>
    </div>
  )
}
