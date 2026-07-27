import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProductCategory } from "@medusajs/types"
import { Container, Heading, Button, Text, Input, Textarea, toast } from "@medusajs/ui"
import { useState } from "react"

type DetailWidgetProps = {
  data: AdminProductCategory
}

type Faq = { question: string; answer: string }

const normalizeFaqs = (meta: Record<string, unknown> | null | undefined): Faq[] => {
  const v = meta?.faqs
  if (!Array.isArray(v)) return []
  return v
    .filter((f): f is Faq => !!f && typeof f === "object")
    .map((f) => ({ question: String(f.question || ""), answer: String(f.answer || "") }))
}

const CategoryFaqsWidget = ({ data }: DetailWidgetProps) => {
  const [faqs, setFaqs] = useState<Faq[]>(normalizeFaqs(data.metadata))
  const [saving, setSaving] = useState(false)

  const hasEmptyField = faqs.some((f) => !f.question.trim() || !f.answer.trim())

  const updateRow = (i: number, patch: Partial<Faq>) => {
    setFaqs((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  }

  const removeRow = (i: number) => {
    setFaqs((prev) => prev.filter((_, idx) => idx !== i))
  }

  const addRow = () => {
    setFaqs((prev) => [...prev, { question: "", answer: "" }])
  }

  const handleSave = async () => {
    if (hasEmptyField) {
      toast.error("Every FAQ needs both a question and an answer")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/admin/product-categories/${data.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: { ...(data.metadata || {}), faqs },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || "Failed to save FAQs")
      }
      toast.success("FAQs saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save FAQs")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Category FAQs</Heading>
        <Button size="small" variant="secondary" onClick={addRow}>
          Add FAQ
        </Button>
      </div>

      <div className="px-6 py-4 flex flex-col gap-4">
        {faqs.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            No FAQs yet. Add one to show it on this category's storefront page.
          </Text>
        ) : (
          faqs.map((faq, i) => (
            <div key={i} className="flex flex-col gap-2 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <Text size="small" weight="plus">
                  FAQ {i + 1}
                </Text>
                <Button size="small" variant="danger" onClick={() => removeRow(i)}>
                  Remove
                </Button>
              </div>
              <Input
                placeholder="Question"
                value={faq.question}
                onChange={(e) => updateRow(i, { question: e.target.value })}
              />
              <Textarea
                placeholder="Answer"
                value={faq.answer}
                onChange={(e) => updateRow(i, { answer: e.target.value })}
                rows={3}
              />
            </div>
          ))
        )}

        <div className="flex items-center justify-between">
          <Text size="xsmall" className="text-ui-fg-muted">
            Both question and answer are required for every FAQ.
          </Text>
          <Button
            size="small"
            disabled={saving || faqs.length === 0 || hasEmptyField}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save FAQs"}
          </Button>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product_category.details.after",
})

export default CategoryFaqsWidget
