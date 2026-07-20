import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProduct } from "@medusajs/types"
import { Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"

/**
 * Rich-text (WYSIWYG) editor for the product description, shown on the product
 * detail page. Saves HTML to `product.description` via the admin API.
 *
 * Dependency-free: uses a contentEditable surface + document.execCommand for
 * formatting (no third-party editor bundled into the admin build). The
 * storefront renders this HTML (sanitized) on the product page; plain-text
 * descriptions still render as before, so existing products are unaffected.
 */

type DetailWidgetProps = { data: AdminProduct }

const looksLikeHtml = (s?: string | null) =>
  !!s && /<([a-z][a-z0-9]*)\b[^>]*>/i.test(s)

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

type Cmd = {
  label: string
  title: string
  run: () => void
}

const ProductDescriptionEditor = ({ data }: DetailWidgetProps) => {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Seed the editor once (uncontrolled — never overwrite while typing).
  useEffect(() => {
    if (!editorRef.current) return
    const desc = (data.description as string | null) || ""
    editorRef.current.innerHTML = looksLikeHtml(desc)
      ? desc
      : desc
        ? `<p>${escapeHtml(desc).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br/>")}</p>`
        : ""
    setDirty(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.id])

  const focusEditor = () => editorRef.current?.focus()

  const exec = (command: string, value?: string) => {
    focusEditor()
    try {
      // prefer semantic tags over inline styles where possible
      document.execCommand("styleWithCSS", false, "false")
    } catch {}
    document.execCommand(command, false, value)
    setDirty(true)
  }

  const commands: Cmd[] = [
    { label: "B", title: "Bold", run: () => exec("bold") },
    { label: "I", title: "Italic", run: () => exec("italic") },
    { label: "U", title: "Underline", run: () => exec("underline") },
    { label: "H2", title: "Heading", run: () => exec("formatBlock", "H2") },
    { label: "H3", title: "Subheading", run: () => exec("formatBlock", "H3") },
    { label: "¶", title: "Paragraph", run: () => exec("formatBlock", "P") },
    { label: "• List", title: "Bulleted list", run: () => exec("insertUnorderedList") },
    { label: "1. List", title: "Numbered list", run: () => exec("insertOrderedList") },
    {
      label: "Link",
      title: "Insert link",
      run: () => {
        const url = window.prompt("Link URL (https://…)")
        if (url) exec("createLink", url)
      },
    },
    { label: "Unlink", title: "Remove link", run: () => exec("unlink") },
    { label: "Clear", title: "Clear formatting", run: () => exec("removeFormat") },
  ]

  // Paste as plain text so the field never fills with junk markup.
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData("text/plain")
    document.execCommand("insertText", false, text)
    setDirty(true)
  }

  const save = async () => {
    const html = (editorRef.current?.innerHTML || "").trim()
    // treat an empty editor as an empty description
    const value = html === "<br>" || html === "<p></p>" ? "" : html
    setSaving(true)
    try {
      const res = await fetch(`/admin/products/${data.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: value }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || "Failed to save")
      }
      toast.success("Description saved")
      setDirty(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="divide-y p-0" data-desc-editor="true">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Description (Rich Text)</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Formats the storefront product description. Overrides the plain
            Description field above.
          </Text>
        </div>
        <Button size="small" onClick={save} isLoading={saving} disabled={!dirty}>
          Save
        </Button>
      </div>

      <div className="px-6 py-4">
        <div className="mb-2 flex flex-wrap gap-1">
          {commands.map((c) => (
            <button
              key={c.label}
              type="button"
              title={c.title}
              onMouseDown={(e) => {
                e.preventDefault() // keep selection in the editor
                c.run()
              }}
              className="txt-compact-small rounded-md border border-ui-border-base bg-ui-bg-subtle px-2 py-1 text-ui-fg-base hover:bg-ui-bg-base-hover"
            >
              {c.label}
            </button>
          ))}
        </div>

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => setDirty(true)}
          onPaste={onPaste}
          className="txt-medium min-h-[160px] w-full rounded-lg border border-ui-border-base bg-ui-bg-field px-3 py-2 text-ui-fg-base outline-none focus:border-ui-border-interactive [&_a]:text-ui-fg-interactive [&_a]:underline [&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-6"
        />
        <Text size="xsmall" className="mt-2 text-ui-fg-muted">
          Tip: paste is inserted as plain text. Use the buttons for headings,
          lists, bold/italic, and links.
        </Text>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductDescriptionEditor
