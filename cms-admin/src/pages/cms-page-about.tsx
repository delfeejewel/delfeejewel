import { useUpdate, useInvalidate } from "@refinedev/core"
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Space,
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
  EditOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  DownOutlined,
  RightOutlined,
} from "@ant-design/icons"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { icons as lucideIcons, type LucideIcon } from "lucide-react"
import { ImageUpload } from "../components/image-upload"
import { RichTextEditor, isRichTextEmpty } from "../components/rich-text-editor"
import { IconPicker } from "../components/icon-picker"
import { ABOUT_TEMPLATE, TEMPLATE_OPTIONS, templateLabel } from "./page-templates"
import { useIsDeveloper } from "../hooks/use-role"

const { Title, Text } = Typography

// Required-WYSIWYG validator (empty Quill docs read as "<p><br></p>").
const richTextRequired = (msg: string) => ({
  validator: (_: any, v: string) =>
    isRichTextEmpty(v) ? Promise.reject(new Error(msg)) : Promise.resolve(),
})

// Strip HTML to a short plain-text preview for the read-only card view.
const stripHtml = (html?: string) =>
  (html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()

// Render a lucide glyph from the kebab-case name saved by IconPicker (e.g.
// "hand-heart" → HandHeart). Used in the read-only value cards.
const toPascalCase = (s: string) =>
  s.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("")

const LucideGlyph = ({ name }: { name?: string }) => {
  if (!name) return null
  const Icon = (lucideIcons as Record<string, LucideIcon>)[toPascalCase(name)]
  return Icon ? <Icon size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} /> : null
}

export { ABOUT_TEMPLATE }

// Rich starting content for a brand-new About-templated page. Editing an
// existing page reads its saved content_json instead (see aboutInitialValues).
const ABOUT_DEFAULTS = {
  hero: {
    eyebrow: "Our Story",
    title: "Jewellery Made to be Treasured",
    description: "A house of handcrafted fine silver jewellery — where heritage craft meets contemporary design, and every piece is made to be loved for years.",
  },
  story: {
    eyebrow: "Where it began",
    title: "A love for silver, shaped by hand",
    image: "",
    body:
      "<p>We began with a simple belief — that fine jewellery should feel personal, honest and built to last.</p>" +
      "<p>Today we work hand-in-hand with master artisans across India, blending generations of craft with designs made for modern life.</p>",
    quote: "We don't just sell silver — we craft heirlooms in the making.",
  },
  stats: [
    { value: "10K+", label: "Happy Customers" },
    { value: "925", label: "Sterling Silver" },
    { value: "50+", label: "Master Artisans" },
    { value: "Pan-India", label: "Shipping & Returns" },
  ],
  values: {
    eyebrow: "What we stand for",
    heading: "The values behind every piece",
    items: [
      { title: "Handcrafted with Care", text: "Every piece is shaped by skilled artisans, never mass-produced.", icon: "hand-heart" },
      { title: "925 Sterling Silver", text: "All our silver is genuine 925 sterling silver.", icon: "shield-check" },
      { title: "Responsibly Sourced", text: "We work with trusted suppliers and ethical practices.", icon: "leaf" },
      { title: "Made to Last", text: "Timeless designs and durable craftsmanship.", icon: "sparkles" },
    ],
  },
  process: {
    eyebrow: "The craft",
    heading: "From sketch to heirloom",
    steps: [
      { title: "Designed", text: "Our designers sketch each collection.", icon: "pen-tool" },
      { title: "Handcrafted", text: "Master artisans cast, set and finish every piece by hand.", icon: "hammer" },
      { title: "Checked", text: "Each piece is checked for purity.", icon: "shield-check" },
      { title: "Delivered", text: "Your jewellery arrives in premium packaging.", icon: "package-check" },
    ],
  },
  cta: {
    eyebrow: "",
    heading: "Find a piece that feels like you",
    icon: "gem",
    description: "Explore our handcrafted collection — each one made to last.",
    buttonLabel: "Shop the Collection",
    buttonHref: "/store",
    buttonTarget: "_self",
  },
}

function safeParse(s: string) {
  try { return JSON.parse(s) } catch { return {} }
}

// Normalise the Story section to the current shape: { eyebrow, title, body, quote, image }.
// Older saved content used { heading, paragraphs[] } — migrate those on read.
function migrateStory(s: any) {
  const story = s || {}
  const title = story.title ?? story.heading ?? ABOUT_DEFAULTS.story.title
  let body = story.body
  if (isRichTextEmpty(body)) {
    body = story.paragraphs?.length
      ? story.paragraphs.map((p: string) => `<p>${p}</p>`).join("")
      : ABOUT_DEFAULTS.story.body
  }
  return {
    eyebrow: story.eyebrow ?? ABOUT_DEFAULTS.story.eyebrow,
    title,
    image: story.image ?? ABOUT_DEFAULTS.story.image,
    body,
    quote: story.quote ?? ABOUT_DEFAULTS.story.quote,
  }
}

// Section fields to merge into the page form's initialValues. `cj` is the saved
// content_json (object or stringified). Missing fields fall back to defaults.
export function aboutInitialValues(cj: any) {
  const c = (typeof cj === "string" ? safeParse(cj) : cj) || {}
  return {
    hero: { ...ABOUT_DEFAULTS.hero, ...(c.hero || {}) },
    story: migrateStory(c.story),
    stats: c.stats?.length ? c.stats : ABOUT_DEFAULTS.stats,
    values: {
      ...ABOUT_DEFAULTS.values,
      ...(c.values || {}),
      items: c.values?.items?.length ? c.values.items : ABOUT_DEFAULTS.values.items,
    },
    process: {
      ...ABOUT_DEFAULTS.process,
      ...(c.process || {}),
      steps: c.process?.steps?.length ? c.process.steps : ABOUT_DEFAULTS.process.steps,
    },
    cta: { ...ABOUT_DEFAULTS.cta, ...(c.cta || {}) },
    visibility: resolveVisibility(c.visibility),
  }
}

// Section keys that can be shown/hidden on the storefront. A missing flag in
// saved content means the section is visible (back-compat with older pages).
const ABOUT_SECTION_KEYS = ["hero", "story", "stats", "values", "process", "cta"] as const

function resolveVisibility(v: any): Record<string, boolean> {
  return ABOUT_SECTION_KEYS.reduce((acc, k) => {
    acc[k] = v?.[k] !== false
    return acc
  }, {} as Record<string, boolean>)
}

// Pull the section fields out of the page form values into a content_json object.
export function aboutContentJson(values: any) {
  return {
    hero: values.hero,
    story: values.story,
    stats: values.stats,
    values: values.values,
    process: values.process,
    cta: values.cta,
    visibility: resolveVisibility(values.visibility),
  }
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text
      type="secondary"
      style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block" }}
    >
      {children}
    </Text>
  )
}

/**
 * The About-template sections. Renders Form.Item/Form.List fields that bind to
 * the surrounding Form (via context) — must be placed inside a <Form>.
 */
export function AboutSections() {
  return (
    <>
      {/* Hero */}
      <Card title="Hero" size="small" style={{ marginBottom: 16 }}>
        <Form.Item label="Eyebrow" name={["hero", "eyebrow"]} rules={[{ required: true, message: "Eyebrow is required" }]} style={{ marginBottom: 12 }}>
          <Input />
        </Form.Item>
        <Form.Item label="Title" name={["hero", "title"]} rules={[{ required: true, message: "Title is required" }]} style={{ marginBottom: 12 }}>
          <Input />
        </Form.Item>
        <Form.Item label="Description" name={["hero", "description"]} rules={[{ required: true, message: "Description is required" }]} style={{ marginBottom: 0 }}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Card>

      {/* Story */}
      <Card title="Story" size="small" style={{ marginBottom: 16 }}>
        <Form.Item label="Eyebrow" name={["story", "eyebrow"]} extra="Optional small label above the title." style={{ marginBottom: 12 }}>
          <Input placeholder="Where it began" />
        </Form.Item>
        <Form.Item label="Title" name={["story", "title"]} rules={[{ required: true, message: "Title is required" }]} style={{ marginBottom: 12 }}>
          <Input placeholder="A love for silver, shaped by hand" />
        </Form.Item>
        <Form.Item label="Featured Image" name={["story", "image"]} rules={[{ required: true, message: "A featured image is required" }]} style={{ marginBottom: 12 }}>
          <ImageUpload folder="pages" required aspectHint="Recommended: portrait, ~620×680px" />
        </Form.Item>
        <Form.Item label="Body" name={["story", "body"]} rules={[richTextRequired("Body is required")]} style={{ marginBottom: 12 }}>
          <RichTextEditor placeholder="Tell the story…" />
        </Form.Item>
        <Form.Item label="Quote" name={["story", "quote"]} style={{ marginBottom: 0 }} extra="Optional pull-quote shown highlighted. Leave blank to hide.">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Card>

      {/* Stats */}
      <Card title="Stats" size="small" style={{ marginBottom: 16 }}>
        <Form.List
          name="stats"
          rules={[{ validator: (_, items) => (items?.length ? Promise.resolve() : Promise.reject(new Error("Add at least one stat"))) }]}
        >
          {(fields, { add, remove }, { errors }) => (
            <>
              {fields.map(({ key, name, ...rest }) => (
                <div key={key} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <Form.Item {...rest} name={[name, "value"]} style={{ width: 160, marginBottom: 0 }} rules={[{ required: true, message: "Value" }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item {...rest} name={[name, "label"]} style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, message: "Label" }]}>
                    <Input />
                  </Form.Item>
                  <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} disabled={fields.length <= 1} />
                </div>
              ))}
              {fields.length < MAX_STATS && (
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ value: "", label: "" })} block>
                  Add stat
                </Button>
              )}
              <Form.ErrorList errors={errors} />
            </>
          )}
        </Form.List>
      </Card>

      {/* Values */}
      <Card title="Values" size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Form.Item label="Eyebrow" name={["values", "eyebrow"]} style={{ marginBottom: 12 }}>
            <Input />
          </Form.Item>
          <Form.Item label="Heading" name={["values", "heading"]} rules={[{ required: true, message: "Heading is required" }]} style={{ marginBottom: 12 }}>
            <Input />
          </Form.Item>
        </div>
        <SectionHeading>Value cards (icons are fixed by position)</SectionHeading>
        <Form.List
          name={["values", "items"]}
          rules={[{ validator: (_, items) => (items?.length ? Promise.resolve() : Promise.reject(new Error("Add at least one value"))) }]}
        >
          {(fields, { add, remove }, { errors }) => (
            <div style={{ marginTop: 8 }}>
              {fields.map(({ key, name, ...rest }) => (
                <div key={key} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <Form.Item {...rest} name={[name, "icon"]} label="Icon" style={{ marginBottom: 0 }}>
                      <IconPicker />
                    </Form.Item>
                    <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} disabled={fields.length <= 1} />
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <Form.Item {...rest} name={[name, "title"]} style={{ width: 220, marginBottom: 0 }} rules={[{ required: true, message: "Title" }]}>
                      <Input />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, "text"]} style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, message: "Text" }]}>
                      <Input.TextArea rows={2} />
                    </Form.Item>
                  </div>
                </div>
              ))}
              {fields.length < 4 && (
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ title: "", text: "", icon: "" })} block>
                  Add value
                </Button>
              )}
              <Form.ErrorList errors={errors} />
            </div>
          )}
        </Form.List>
      </Card>

      {/* Process */}
      <Card title="Process" size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Form.Item label="Eyebrow" name={["process", "eyebrow"]} style={{ marginBottom: 12 }}>
            <Input />
          </Form.Item>
          <Form.Item label="Heading" name={["process", "heading"]} rules={[{ required: true, message: "Heading is required" }]} style={{ marginBottom: 12 }}>
            <Input />
          </Form.Item>
        </div>
        <SectionHeading>Steps (numbered, pick an icon for each)</SectionHeading>
        <Form.List
          name={["process", "steps"]}
          rules={[{ validator: (_, items) => (items?.length ? Promise.resolve() : Promise.reject(new Error("Add at least one step"))) }]}
        >
          {(fields, { add, remove }, { errors }) => (
            <div style={{ marginTop: 8 }}>
              {fields.map(({ key, name, ...rest }) => (
                <div key={key} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <Form.Item {...rest} name={[name, "icon"]} label="Icon" style={{ marginBottom: 0 }}>
                      <IconPicker />
                    </Form.Item>
                    <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} disabled={fields.length <= 1} />
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <Form.Item {...rest} name={[name, "title"]} style={{ width: 220, marginBottom: 0 }} rules={[{ required: true, message: "Title" }]}>
                      <Input />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, "text"]} style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, message: "Text" }]}>
                      <Input.TextArea rows={2} />
                    </Form.Item>
                  </div>
                </div>
              ))}
              {fields.length < 4 && (
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ title: "", text: "", icon: "" })} block>
                  Add step
                </Button>
              )}
              <Form.ErrorList errors={errors} />
            </div>
          )}
        </Form.List>
      </Card>

      {/* CTA */}
      <Card title="Call to Action" size="small" style={{ marginBottom: 16 }}>
        <Form.Item label="Eyebrow" name={["cta", "eyebrow"]} extra="Optional small label above the heading." style={{ marginBottom: 12 }}>
          <Input />
        </Form.Item>
        <Form.Item label="Icon" name={["cta", "icon"]} rules={[{ required: true, message: "Icon is required" }]} style={{ marginBottom: 12 }}>
          <IconPicker />
        </Form.Item>
        <Form.Item label="Heading" name={["cta", "heading"]} rules={[{ required: true, message: "Heading is required" }]} style={{ marginBottom: 12 }}>
          <Input />
        </Form.Item>
        <Form.Item label="Description" name={["cta", "description"]} style={{ marginBottom: 12 }}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Form.Item label="Button Label" name={["cta", "buttonLabel"]} rules={[{ required: true, message: "Button label is required" }]} style={{ marginBottom: 12 }}>
            <Input />
          </Form.Item>
          <Form.Item label="Button Link" name={["cta", "buttonHref"]} rules={[{ required: true, message: "Button link is required" }]} style={{ marginBottom: 12 }}>
            <Input />
          </Form.Item>
        </div>
        <Form.Item label="Open Link In" name={["cta", "buttonTarget"]} rules={[{ required: true, message: "Select where the link opens" }]} style={{ marginBottom: 0 }}>
          <Select options={CTA_TARGET_OPTIONS} />
        </Form.Item>
      </Card>
    </>
  )
}

/* ════════════════════════════════════════════════════════
   Section-wise editor (one Edit/Save/Cancel per section).
   Every save writes the whole content_json + page columns.
   ════════════════════════════════════════════════════════ */

export function ReadRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
      <Text type="secondary" style={{ width: 120, flexShrink: 0, fontSize: 13 }}>{label}</Text>
      <div style={{ flex: 1, fontSize: 13, minWidth: 0 }}>{children}</div>
    </div>
  )
}

export const muted = <Text type="secondary" style={{ fontStyle: "italic" }}>—</Text>

// Tracks which section cards are collapsed (keyed by section key).
export function useCollapse() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const toggle = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }))
  return { collapsed, toggle }
}

// A row of chips, one per section, that collapse/expand the matching card.
export function SectionChips({
  sections,
  collapsed,
  onToggle,
}: {
  sections: { key: string; label: string }[]
  collapsed: Record<string, boolean>
  onToggle: (key: string) => void
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 20,
        padding: "12px 14px",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        background: "rgba(255,255,255,0.02)",
      }}
    >
      {sections.map((s) => {
        const open = !collapsed[s.key]
        return (
          <Button
            key={s.key}
            size="small"
            type={open ? "default" : "dashed"}
            icon={open ? <DownOutlined /> : <RightOutlined />}
            onClick={() => onToggle(s.key)}
          >
            {s.label}
          </Button>
        )
      })}
    </div>
  )
}

// A card that toggles between a read-only view and an inline edit form with its
// own Save/Cancel. `value` seeds the form; `onSave(values, done)` persists.
// When `collapsed`, only the title bar shows.
export function EditableCard({
  title,
  tag,
  value,
  saving,
  onSave,
  read,
  children,
  collapsed = false,
  onToggleCollapse,
  visible,
  onToggleVisible,
}: {
  title: string
  tag?: React.ReactNode
  value: any
  saving: boolean
  onSave: (values: any, done: () => void) => void
  read: React.ReactNode
  children: React.ReactNode
  collapsed?: boolean
  onToggleCollapse?: () => void
  visible?: boolean
  onToggleVisible?: (next: boolean) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form] = Form.useForm()

  const submit = () => {
    form.validateFields()
      .then((v) => onSave(v, () => setEditing(false)))
      .catch(() => {})
  }

  return (
    <Card
      size="small"
      style={{ marginBottom: 16, opacity: onToggleVisible && visible === false ? 0.6 : 1 }}
      styles={collapsed ? { body: { display: "none" } } : undefined}
      title={
        <Space
          style={{ cursor: onToggleCollapse ? "pointer" : undefined }}
          onClick={onToggleCollapse}
        >
          {onToggleCollapse && (collapsed ? <RightOutlined style={{ fontSize: 11, opacity: 0.5 }} /> : <DownOutlined style={{ fontSize: 11, opacity: 0.5 }} />)}
          {title}
          {tag}
        </Space>
      }
      extra={
        !collapsed && (
          <Space size={10}>
            {onToggleVisible && (
              <Switch
                size="small"
                checked={visible}
                onChange={onToggleVisible}
                disabled={saving || editing}
                checkedChildren="Shown"
                unCheckedChildren="Hidden"
              />
            )}
            {!editing && <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(true)}>Edit</Button>}
          </Space>
        )
      }
    >
      {editing ? (
        <Form form={form} layout="vertical" initialValues={value}>
          {children}
          <Space style={{ marginTop: 12 }}>
            <Button type="primary" size="small" icon={<SaveOutlined />} loading={saving} onClick={submit}>Save</Button>
            <Button size="small" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
          </Space>
        </Form>
      ) : read}
    </Card>
  )
}

/* ─── Edit-mode field groups (relative names, for EditableCard forms) ─── */

const HeroFields = () => (
  <>
    <Form.Item label="Eyebrow" name="eyebrow" rules={[{ required: true, message: "Eyebrow is required" }]} style={{ marginBottom: 12 }}>
      <Input />
    </Form.Item>
    <Form.Item label="Title" name="title" rules={[{ required: true, message: "Title is required" }]} style={{ marginBottom: 12 }}>
      <Input />
    </Form.Item>
    <Form.Item label="Description" name="description" rules={[{ required: true, message: "Description is required" }]} style={{ marginBottom: 0 }}>
      <Input.TextArea rows={2} />
    </Form.Item>
  </>
)

const StoryFields = () => (
  <>
    <Form.Item label="Eyebrow" name="eyebrow" extra="Optional small label above the title." style={{ marginBottom: 12 }}>
      <Input placeholder="Where it began" />
    </Form.Item>
    <Form.Item label="Title" name="title" rules={[{ required: true, message: "Title is required" }]} style={{ marginBottom: 12 }}>
      <Input placeholder="A love for silver, shaped by hand" />
    </Form.Item>
    <Form.Item label="Featured Image" name="image" rules={[{ required: true, message: "A featured image is required" }]} style={{ marginBottom: 12 }}>
      <ImageUpload folder="pages" required aspectHint="Recommended: portrait, ~620×680px" />
    </Form.Item>
    <Form.Item label="Body" name="body" rules={[richTextRequired("Body is required")]} style={{ marginBottom: 12 }}>
      <RichTextEditor placeholder="Tell the story…" />
    </Form.Item>
    <Form.Item label="Quote" name="quote" style={{ marginBottom: 0 }} extra="Optional pull-quote shown highlighted. Leave blank to hide.">
      <Input.TextArea rows={2} />
    </Form.Item>
  </>
)

// Stats must have at least one and at most MAX_STATS entries.
const MAX_STATS = 4

const StatsFields = () => (
  <Form.List
    name="items"
    rules={[{ validator: (_, items) => (items?.length ? Promise.resolve() : Promise.reject(new Error("Add at least one stat"))) }]}
  >
    {(fields, { add, remove }, { errors }) => (
      <>
        {fields.map(({ key, name, ...rest }) => (
          <div key={key} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <Form.Item {...rest} name={[name, "value"]} style={{ width: 160, marginBottom: 0 }} rules={[{ required: true, message: "Value" }]}>
              <Input />
            </Form.Item>
            <Form.Item {...rest} name={[name, "label"]} style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, message: "Label" }]}>
              <Input />
            </Form.Item>
            <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} disabled={fields.length <= 1} />
          </div>
        ))}
        {fields.length < MAX_STATS && (
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ value: "", label: "" })} block>Add stat</Button>
        )}
        <Form.ErrorList errors={errors} />
      </>
    )}
  </Form.List>
)

// Shared by Values and Process. When `maxItems` is set, the list is constrained
// to at least one and at most `maxItems` cards; `requireHeading` makes the
// section heading mandatory.
const CardListFields = ({
  listName,
  addLabel,
  requireHeading = false,
  maxItems,
  withIcon = false,
}: {
  listName: string
  addLabel: string
  requireHeading?: boolean
  maxItems?: number
  withIcon?: boolean
}) => (
  <>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Form.Item label="Eyebrow" name="eyebrow" style={{ marginBottom: 12 }}><Input /></Form.Item>
      <Form.Item label="Heading" name="heading" rules={requireHeading ? [{ required: true, message: "Heading is required" }] : undefined} style={{ marginBottom: 12 }}><Input /></Form.Item>
    </div>
    <SectionHeading>{withIcon ? "Items (pick an icon for each)" : "Items (icons are fixed by position)"}</SectionHeading>
    <Form.List
      name={listName}
      rules={maxItems ? [{ validator: (_, items) => (items?.length ? Promise.resolve() : Promise.reject(new Error("Add at least one"))) }] : undefined}
    >
      {(fields, { add, remove }, { errors }) => (
        <div style={{ marginTop: 8 }}>
          {fields.map(({ key, name, ...rest }) =>
            withIcon ? (
              <div key={key} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Form.Item {...rest} name={[name, "icon"]} label="Icon" style={{ marginBottom: 0 }}>
                    <IconPicker />
                  </Form.Item>
                  <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} disabled={!!maxItems && fields.length <= 1} />
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Form.Item {...rest} name={[name, "title"]} style={{ width: 220, marginBottom: 0 }} rules={[{ required: true, message: "Title" }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item {...rest} name={[name, "text"]} style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, message: "Text" }]}>
                    <Input.TextArea rows={2} />
                  </Form.Item>
                </div>
              </div>
            ) : (
              <div key={key} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                <Form.Item {...rest} name={[name, "title"]} style={{ width: 220, marginBottom: 0 }} rules={[{ required: true, message: "Title" }]}>
                  <Input />
                </Form.Item>
                <Form.Item {...rest} name={[name, "text"]} style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, message: "Text" }]}>
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} disabled={!!maxItems && fields.length <= 1} />
              </div>
            )
          )}
          {(!maxItems || fields.length < maxItems) && (
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ title: "", text: "", ...(withIcon ? { icon: "" } : {}) })} block>{addLabel}</Button>
          )}
          {maxItems && <Form.ErrorList errors={errors} />}
        </div>
      )}
    </Form.List>
  </>
)

// Where the CTA link opens. Stored as the HTML anchor target value.
const CTA_TARGET_OPTIONS = [
  { value: "_self", label: "Same tab" },
  { value: "_blank", label: "New tab" },
]
const ctaTargetLabel = (t?: string) => CTA_TARGET_OPTIONS.find((o) => o.value === t)?.label ?? t

const CtaFields = () => (
  <>
    <Form.Item label="Eyebrow" name="eyebrow" extra="Optional small label above the heading." style={{ marginBottom: 12 }}>
      <Input />
    </Form.Item>
    <Form.Item label="Icon" name="icon" rules={[{ required: true, message: "Icon is required" }]} style={{ marginBottom: 12 }}>
      <IconPicker />
    </Form.Item>
    <Form.Item label="Heading" name="heading" rules={[{ required: true, message: "Heading is required" }]} style={{ marginBottom: 12 }}>
      <Input />
    </Form.Item>
    <Form.Item label="Description" name="description" style={{ marginBottom: 12 }}>
      <Input.TextArea rows={2} />
    </Form.Item>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Form.Item label="Button Label" name="buttonLabel" rules={[{ required: true, message: "Button label is required" }]} style={{ marginBottom: 12 }}>
        <Input />
      </Form.Item>
      <Form.Item label="Button Link" name="buttonHref" rules={[{ required: true, message: "Button link is required" }]} style={{ marginBottom: 12 }}>
        <Input />
      </Form.Item>
    </div>
    <Form.Item label="Open Link In" name="buttonTarget" rules={[{ required: true, message: "Select where the link opens" }]} style={{ marginBottom: 0 }}>
      <Select options={CTA_TARGET_OPTIONS} />
    </Form.Item>
  </>
)

/* ─── Read-only views ─── */

const TextLines = ({ items, render }: { items: any[]; render: (x: any) => React.ReactNode }) =>
  items?.length ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{items.map((x, i) => <div key={i}>{render(x)}</div>)}</div>
  ) : <>{muted}</>

const HeroRead = ({ v }: { v: any }) => (
  <>
    <ReadRow label="Eyebrow">{v.eyebrow || muted}</ReadRow>
    <ReadRow label="Title"><Text strong>{v.title || muted}</Text></ReadRow>
    <ReadRow label="Description">{v.description || muted}</ReadRow>
  </>
)

const StoryRead = ({ v }: { v: any }) => {
  const preview = stripHtml(v.body)
  return (
    <>
      <ReadRow label="Eyebrow">{v.eyebrow || muted}</ReadRow>
      <ReadRow label="Title"><Text strong>{v.title || muted}</Text></ReadRow>
      <ReadRow label="Image">
        {v.image ? <img src={v.image} alt="" style={{ height: 64, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)" }} /> : muted}
      </ReadRow>
      <ReadRow label="Body">{preview ? <Text>{preview.length > 200 ? preview.slice(0, 200) + "…" : preview}</Text> : muted}</ReadRow>
      <ReadRow label="Quote">{v.quote ? <Text italic>“{v.quote}”</Text> : muted}</ReadRow>
    </>
  )
}

const StatsRead = ({ items }: { items: any[] }) => (
  items?.length ? (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      {items.map((s, i) => (
        <div key={i} style={{ minWidth: 120 }}>
          <Text strong style={{ fontSize: 18, display: "block" }}>{s.value}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{s.label}</Text>
        </div>
      ))}
    </div>
  ) : <>{muted}</>
)

const CardListRead = ({ v, items }: { v: any; items: any[] }) => (
  <>
    <ReadRow label="Eyebrow">{v.eyebrow || muted}</ReadRow>
    <ReadRow label="Heading"><Text strong>{v.heading || muted}</Text></ReadRow>
    <ReadRow label="Items">
      <TextLines items={items} render={(it) => <Text>{it.icon ? <LucideGlyph name={it.icon} /> : "• "}{it.title}</Text>} />
    </ReadRow>
  </>
)

const CtaRead = ({ v }: { v: any }) => (
  <>
    <ReadRow label="Eyebrow">{v.eyebrow || muted}</ReadRow>
    <ReadRow label="Icon">{v.icon ? <Text><LucideGlyph name={v.icon} />{v.icon}</Text> : muted}</ReadRow>
    <ReadRow label="Heading"><Text strong>{v.heading || muted}</Text></ReadRow>
    <ReadRow label="Description">{v.description || muted}</ReadRow>
    <ReadRow label="Button">
      {v.buttonLabel
        ? <Text>{v.buttonLabel} → <Text code>{v.buttonHref}</Text> ({ctaTargetLabel(v.buttonTarget)})</Text>
        : muted}
    </ReadRow>
  </>
)

/* ─── Main section-wise editor ─── */

export function AboutTemplateEditor({ record }: { record: any }) {
  const navigate = useNavigate()
  const invalidate = useInvalidate()
  const { mutate: update, isLoading: saving } = useUpdate()

  const isDeveloper = useIsDeveloper()

  const [content, setContent] = useState<any>(() => aboutInitialValues(record.content_json))
  const [meta, setMeta] = useState({
    title: record.title || "",
    slug: record.slug || "",
    template: record.template || ABOUT_TEMPLATE,
    meta_title: record.meta_title || "",
    meta_description: record.meta_description || "",
    is_published: !!record.is_published,
  })

  // Persist the full document (page columns + content_json) and update local state.
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
        <Title level={3} style={{ margin: 0 }}>Edit About Page</Title>
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

          <EditableCard title="Story" tag={vis.story === false ? hiddenTag : undefined} visible={vis.story} onToggleVisible={(n) => toggleVisible("story", n)} value={content.story} saving={saving} onSave={(v, d) => saveSection("story", v, d)} read={<StoryRead v={content.story} />}>
            <StoryFields />
          </EditableCard>

          <EditableCard title="Stats" tag={vis.stats === false ? hiddenTag : undefined} visible={vis.stats} onToggleVisible={(n) => toggleVisible("stats", n)} value={{ items: content.stats }} saving={saving} onSave={(v, d) => saveSection("stats", v.items, d)} read={<StatsRead items={content.stats} />}>
            <StatsFields />
          </EditableCard>

          <EditableCard title="Values" tag={vis.values === false ? hiddenTag : undefined} visible={vis.values} onToggleVisible={(n) => toggleVisible("values", n)} value={content.values} saving={saving} onSave={(v, d) => saveSection("values", v, d)} read={<CardListRead v={content.values} items={content.values?.items} />}>
            <CardListFields listName="items" addLabel="Add value" requireHeading maxItems={4} withIcon />
          </EditableCard>

          <EditableCard title="Process" tag={vis.process === false ? hiddenTag : undefined} visible={vis.process} onToggleVisible={(n) => toggleVisible("process", n)} value={content.process} saving={saving} onSave={(v, d) => saveSection("process", v, d)} read={<CardListRead v={content.process} items={content.process?.steps} />}>
            <CardListFields listName="steps" addLabel="Add step" requireHeading maxItems={4} withIcon />
          </EditableCard>

          <EditableCard title="Call to Action" tag={vis.cta === false ? hiddenTag : undefined} visible={vis.cta} onToggleVisible={(n) => toggleVisible("cta", n)} value={content.cta} saving={saving} onSave={(v, d) => saveSection("cta", v, d)} read={<CtaRead v={content.cta} />}>
            <CtaFields />
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
                  // Switching template re-routes to the matching editor on reopen.
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
