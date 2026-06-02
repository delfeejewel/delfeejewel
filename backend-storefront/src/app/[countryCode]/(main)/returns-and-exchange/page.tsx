import { Metadata } from "next"

import { pageMetadata } from "@lib/util/content-seo"
import { BRAND } from "@lib/constants.brand"
import { getPage } from "@lib/data/cms"
import LegalPage, { LegalSection } from "@modules/content/components/legal-page"
import { cmsSections } from "@modules/content/components/legal-page/cms"

type Props = { params: Promise<{ countryCode: string }> }

const SLUG = "returns-and-exchange"
const LAST_UPDATED = "22 May 2026"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  const page = await getPage(SLUG)
  return pageMetadata({
    countryCode,
    path: `/${SLUG}`,
    title: page?.meta_title || page?.title || "Returns & Exchange",
    description:
      page?.meta_description ||
      `Our easy returns and exchange policy — eligibility, timelines and how to request a return at ${BRAND.name}.`,
  })
}

const SECTIONS: LegalSection[] = [
  {
    id: "overview",
    heading: "Our Promise",
    body: (
      <p>
        We want you to love your jewellery. If something isn't quite right, our
        return and exchange process is designed to be simple and fair. Please
        review the details below to see how it works.
      </p>
    ),
  },
  {
    id: "eligibility",
    heading: "Return Eligibility",
    body: (
      <>
        <p>You may request a return or exchange when:</p>
        <ul>
          <li>
            The request is raised within <strong>7 days</strong> of delivery.
          </li>
          <li>
            The item is unused, unworn and in its original condition.
          </li>
          <li>
            All original packaging, tags, certificates and invoices are
            included.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "non-returnable",
    heading: "Items That Cannot Be Returned",
    body: (
      <>
        <p>For hygiene and safety reasons, we cannot accept returns of:</p>
        <ul>
          <li>Earrings and nose pins, once the seal is opened.</li>
          <li>Customised, engraved or made-to-order pieces.</li>
          <li>Items purchased during clearance or final-sale promotions.</li>
          <li>Items showing signs of wear, damage or alteration.</li>
        </ul>
      </>
    ),
  },
  {
    id: "how-to-return",
    heading: "How to Initiate a Return",
    body: (
      <>
        <p>To start a return or exchange:</p>
        <ul>
          <li>
            Email us at{" "}
            <a href="mailto:support@delfee.com">support@delfee.com</a> with your
            order number and reason, or contact us via our{" "}
            <a href="/contact">Contact page</a>.
          </li>
          <li>Our team will confirm eligibility and share pickup details.</li>
          <li>
            Pack the item securely with all original packaging and documents.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "exchanges",
    heading: "Exchanges",
    body: (
      <p>
        Eligible items can be exchanged for a different size or design of equal
        value. If the new item costs more, the difference is payable; if it
        costs less, the balance is refunded as store credit or to your original
        payment method.
      </p>
    ),
  },
  {
    id: "refunds",
    heading: "Refunds",
    body: (
      <>
        <p>
          Once your returned item is received and inspected, we will notify you
          of the outcome:
        </p>
        <ul>
          <li>
            Approved refunds are processed to the original payment method within{" "}
            <strong>5–7 business days</strong>.
          </li>
          <li>
            Shipping charges, if any, are non-refundable unless the return is
            due to our error.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "damaged",
    heading: "Damaged or Defective Items",
    body: (
      <p>
        If your order arrives damaged or defective, please contact us within{" "}
        <strong>48 hours</strong> of delivery with photographs of the item and
        packaging. We will arrange a replacement or full refund at no extra cost
        to you.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Need Help?",
    body: (
      <p>
        For anything related to returns or exchanges, email{" "}
        <a href="mailto:support@delfee.com">support@delfee.com</a> and our team
        will be glad to assist.
      </p>
    ),
  },
]

export default async function ReturnsPage() {
  const page = await getPage(SLUG)
  const cj = page?.content_json
  return (
    <LegalPage
      title={page?.title || "Returns & Exchange"}
      eyebrow={cj?.eyebrow || "Customer Care"}
      intro={cj?.intro || "Changed your mind or need a different size? Here's everything you need to know about returns and exchanges."}
      lastUpdated={cj?.lastUpdated || LAST_UPDATED}
      sections={cmsSections(cj, SECTIONS)}
    />
  )
}
