import FaqAccordion from "@modules/content/components/faq-accordion"
import { CATEGORY_FAQS, GENERIC_FAQS } from "./faq-data"

export default function CategoryFaq({
  categoryHandle,
  categoryName,
}: {
  categoryHandle: string
  categoryName: string
}) {
  const items = CATEGORY_FAQS[categoryHandle] || GENERIC_FAQS

  return (
    <div className="max-w-[820px] mx-auto py-10 small:py-12">
      <h2 className="font-wittgenstein text-[22px] small:text-[26px] font-bold text-[var(--color-plum)] mb-5">
        {categoryName} FAQs
      </h2>
      <FaqAccordion items={items} startOpen={null} />
    </div>
  )
}
