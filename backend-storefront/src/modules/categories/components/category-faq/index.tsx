import FaqAccordion, { type FaqItem } from "@modules/content/components/faq-accordion"
import { CATEGORY_FAQS } from "./faq-data"

export default function CategoryFaq({
  categoryHandle,
  categoryName,
  faqs,
}: {
  categoryHandle: string
  categoryName: string
  faqs?: FaqItem[]
}) {
  // FAQs set on the category in the admin (metadata.faqs) win; otherwise the
  // curated set for this handle. A category with neither renders nothing at all
  // — only Rings, Bracelets and Rakhis have FAQs, and there is deliberately no
  // generic fallback padding out the rest.
  const items = faqs && faqs.length > 0 ? faqs : CATEGORY_FAQS[categoryHandle] || []

  if (!items.length) {
    return null
  }

  return (
    <div className="max-w-[820px] mx-auto py-10 small:py-12">
      <h2 className="font-wittgenstein text-[1.375rem] small:text-[1.625rem] font-bold text-[var(--color-plum)] mb-5">
        {categoryName} FAQs
      </h2>
      <FaqAccordion items={items} startOpen={null} />
    </div>
  )
}
