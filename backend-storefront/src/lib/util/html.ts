/**
 * Helpers for rendering the admin-authored product description, which may now
 * contain rich-text HTML (from the admin WYSIWYG editor) or be plain text
 * (older products). Descriptions are written by trusted admins, but we still
 * sanitize defensively before dangerouslySetInnerHTML.
 */

// Inline + block tags the description editor can produce.
const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s",
  "h2", "h3", "h4", "ul", "ol", "li", "a", "span", "blockquote",
])

/** True when the string contains at least one HTML tag. */
export function isHtml(s?: string | null): boolean {
  return !!s && /<([a-z][a-z0-9]*)\b[^>]*>/i.test(s)
}

/** Strip all tags/entities to plain text — for meta descriptions & JSON-LD. */
export function stripHtml(s?: string | null): string {
  if (!s) return ""
  return s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Allowlist sanitizer: removes scripts/handlers/js: URLs and any tag not in
 * ALLOWED_TAGS (keeping inner text), and forces safe rel/target on links.
 */
export function sanitizeHtml(s?: string | null): string {
  if (!s) return ""
  let out = s
    // drop dangerous elements entirely (with content)
    .replace(
      /<\s*(script|style|iframe|object|embed|form|link|meta|svg)[\s\S]*?<\s*\/\s*\1\s*>/gi,
      ""
    )
    .replace(/<\s*(script|style|iframe|object|embed|form|link|meta|svg)\b[^>]*>/gi, "")
    // strip inline event handlers (onclick=…)
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    // neutralize javascript: / data: URLs
    .replace(/(href|src)\s*=\s*"(\s*(?:javascript|data):[^"]*)"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'(\s*(?:javascript|data):[^']*)'/gi, "$1='#'")

  // remove any tag not on the allowlist, keeping its inner content
  out = out.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (m, tag: string) =>
    ALLOWED_TAGS.has(tag.toLowerCase()) ? m : ""
  )

  // force safe attributes on anchors
  out = out.replace(/<a\b([^>]*)>/gi, (_m, attrs: string) => {
    const href = attrs.match(/href\s*=\s*("[^"]*"|'[^']*')/i)?.[1] || '"#"'
    return `<a href=${href} target="_blank" rel="noopener noreferrer nofollow">`
  })

  return out.trim()
}
