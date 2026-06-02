import ReactQuill from "react-quill-new"
import "react-quill-new/dist/quill.snow.css"

type RichTextEditorProps = {
  value?: string
  onChange?: (html: string) => void
  placeholder?: string
  minHeight?: number
}

const MODULES = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link"],
    ["clean"],
  ],
}

const FORMATS = ["header", "bold", "italic", "underline", "list", "link"]

// Quill represents an empty document as "<p><br></p>" — treat that as blank so
// required-field validation works.
export const isRichTextEmpty = (html?: string) =>
  !html || html.replace(/<(p|br|\/p|br\/)>/g, "").replace(/&nbsp;|\s/g, "") === ""

/**
 * Controlled WYSIWYG editor that slots into an antd <Form.Item> via value/onChange.
 * Outputs sanitisable HTML (rendered on the storefront through DOMPurify).
 */
export function RichTextEditor({ value, onChange, placeholder, minHeight = 180 }: RichTextEditorProps) {
  return (
    <div className="cms-rich-text" style={{ ["--rte-min-height" as any]: `${minHeight}px` }}>
      <ReactQuill
        theme="snow"
        value={value || ""}
        onChange={(html) => onChange?.(isRichTextEmpty(html) ? "" : html)}
        modules={MODULES}
        formats={FORMATS}
        placeholder={placeholder}
      />
      {/* Light editing surface keeps body copy readable inside the dark admin. */}
      <style>{`
        .cms-rich-text .ql-toolbar {
          border-radius: 8px 8px 0 0;
          background: #f5f5f5;
          border-color: #d9d9d9;
        }
        .cms-rich-text .ql-container {
          border-radius: 0 0 8px 8px;
          border-color: #d9d9d9;
          background: #fff;
          font-size: 14px;
        }
        .cms-rich-text .ql-editor {
          min-height: var(--rte-min-height);
          color: #1f1f1f;
        }
        .cms-rich-text .ql-editor.ql-blank::before {
          color: #999;
          font-style: normal;
        }
      `}</style>
    </div>
  )
}
