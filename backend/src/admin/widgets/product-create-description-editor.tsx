import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"

/**
 * Rich-text description for the PRODUCT CREATE form (admin role only).
 *
 * Medusa exposes no widget zone inside the create form, so — like the other
 * create-form tweaks in this project — we run a MutationObserver from the
 * product LIST page (the create form renders as a focus-modal over the list).
 * When the create form's Description <textarea> appears we:
 *   1. hide the plain textarea (kept in the DOM so it still submits),
 *   2. inject a lightweight contentEditable rich editor + toolbar in its place,
 *   3. mirror the editor's HTML back into the textarea via the native value
 *      setter + an `input` event, so react-hook-form captures it on submit.
 *
 * Developers keep the plain box. Dependency-free (execCommand), matching the
 * detail-page WYSIWYG widget.
 */

const EXEC = (cmd: string, value?: string) => {
  try {
    document.execCommand("styleWithCSS", false, "false")
  } catch {}
  document.execCommand(cmd, false, value)
}

const TOOLBAR: { label: string; title: string; run: () => void }[] = [
  { label: "B", title: "Bold", run: () => EXEC("bold") },
  { label: "I", title: "Italic", run: () => EXEC("italic") },
  { label: "U", title: "Underline", run: () => EXEC("underline") },
  { label: "H2", title: "Heading", run: () => EXEC("formatBlock", "H2") },
  { label: "H3", title: "Subheading", run: () => EXEC("formatBlock", "H3") },
  { label: "¶", title: "Paragraph", run: () => EXEC("formatBlock", "P") },
  { label: "• List", title: "Bulleted list", run: () => EXEC("insertUnorderedList") },
  { label: "1. List", title: "Numbered list", run: () => EXEC("insertOrderedList") },
  {
    label: "Link",
    title: "Insert link",
    run: () => {
      const url = window.prompt("Link URL (https://…)")
      if (url) EXEC("createLink", url)
    },
  },
  { label: "Unlink", title: "Remove link", run: () => EXEC("unlink") },
  { label: "Clear", title: "Clear formatting", run: () => EXEC("removeFormat") },
]

const looksLikeHtml = (s: string) => /<([a-z][a-z0-9]*)\b[^>]*>/i.test(s)
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

// Write a value into a React-controlled textarea so RHF's onChange fires.
const setTextareaValue = (ta: HTMLTextAreaElement, html: string) => {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value"
  )?.set
  setter ? setter.call(ta, html) : (ta.value = html)
  ta.dispatchEvent(new Event("input", { bubbles: true }))
}

const findDescriptionTextarea = (): HTMLTextAreaElement | null => {
  const byName = document.querySelector<HTMLTextAreaElement>(
    'textarea[name="description"]'
  )
  if (byName) return byName
  // fallback: a <label> "Description" associated with a textarea
  const label = Array.from(document.querySelectorAll<HTMLLabelElement>("label")).find(
    (l) => (l.textContent || "").replace(/\s+/g, " ").trim() === "Description"
  )
  if (!label) return null
  const forId = label.getAttribute("for")
  if (forId) {
    const el = document.getElementById(forId)
    if (el instanceof HTMLTextAreaElement) return el
  }
  const field = label.closest("div")
  return field?.querySelector("textarea") || null
}

const enhance = () => {
  const ta = findDescriptionTextarea()
  if (!ta || ta.dataset.rteEnhanced === "1") return
  ta.dataset.rteEnhanced = "1"

  // hide the plain textarea but keep it in the form
  ta.style.display = "none"

  const wrap = document.createElement("div")
  wrap.setAttribute("data-desc-editor", "true")

  const toolbar = document.createElement("div")
  toolbar.className = "mb-2 flex flex-wrap gap-1"
  for (const cmd of TOOLBAR) {
    const b = document.createElement("button")
    b.type = "button"
    b.title = cmd.title
    b.textContent = cmd.label
    b.className =
      "txt-compact-small rounded-md border border-ui-border-base bg-ui-bg-subtle px-2 py-1 text-ui-fg-base hover:bg-ui-bg-base-hover"
    b.addEventListener("mousedown", (e) => {
      e.preventDefault() // keep the selection inside the editor
      editor.focus()
      cmd.run()
      sync()
    })
    toolbar.appendChild(b)
  }

  const editor = document.createElement("div")
  editor.contentEditable = "true"
  editor.className =
    "txt-medium min-h-[160px] w-full rounded-lg border border-ui-border-base bg-ui-bg-field px-3 py-2 text-ui-fg-base outline-none focus:border-ui-border-interactive [&_a]:text-ui-fg-interactive [&_a]:underline [&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-6"

  // seed from any existing value
  const initial = ta.value || ""
  editor.innerHTML = looksLikeHtml(initial)
    ? initial
    : initial
      ? `<p>${escapeHtml(initial).replace(/\n/g, "<br/>")}</p>`
      : ""

  const hint = document.createElement("p")
  hint.className = "txt-compact-small mt-2 text-ui-fg-muted"
  hint.textContent =
    "Rich-text description — formats the storefront product page. Paste is inserted as plain text."

  const sync = () => {
    const html = editor.innerHTML.trim()
    setTextareaValue(ta, html === "<br>" || html === "<p></p>" ? "" : html)
  }

  editor.addEventListener("input", sync)
  editor.addEventListener("paste", (e) => {
    e.preventDefault()
    const text = (e as ClipboardEvent).clipboardData?.getData("text/plain") || ""
    document.execCommand("insertText", false, text)
    sync()
  })

  wrap.appendChild(toolbar)
  wrap.appendChild(editor)
  wrap.appendChild(hint)
  ta.insertAdjacentElement("afterend", wrap)
  if (initial) sync()
}

const ProductCreateDescriptionEditor = () => {
  useEffect(() => {
    let observer: MutationObserver | null = null
    let cancelled = false

    fetch("/admin/users/me", { credentials: "include" })
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return
        const role = body?.user?.metadata?.role ?? "admin"
        if (role === "developer") return // developers keep the plain box
        enhance()
        observer = new MutationObserver(() => enhance())
        observer.observe(document.body, { childList: true, subtree: true })
      })
      .catch(() => {
        /* leave the form untouched on error */
      })

    return () => {
      cancelled = true
      observer?.disconnect()
    }
  }, [])

  return null
}

export const config = defineWidgetConfig({
  zone: "product.list.before",
})

export default ProductCreateDescriptionEditor
