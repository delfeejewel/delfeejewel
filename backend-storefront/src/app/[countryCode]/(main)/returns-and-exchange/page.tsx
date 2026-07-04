import { Metadata } from "next"

import { pageMetadata } from "@lib/util/content-seo"
import { BRAND } from "@lib/constants.brand"
import { getPage } from "@lib/data/cms"
import LegalPage, { LegalSection } from "@modules/content/components/legal-page"
import { cmsSections } from "@modules/content/components/legal-page/cms"

type Props = { params: Promise<{ countryCode: string }> }

const SLUG = "returns-and-exchange"
const LAST_UPDATED = "1 August 2026"

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
    id: "return-eligibility",
    heading: "Return Eligibility",
    body: (
      <>
        <p>We accept return requests under the following conditions:</p>
        <ul>
          <li>Returns must be requested within 7 days of the date of delivery.</li>
          <li>The product must be unused, unworn, undamaged, and in its original condition.</li>
          <li>The jewellery must be returned in its original packaging, including all boxes, pouches, and accessories.</li>
          <li>The original invoice, authenticity certificate, and any product documentation must accompany the return.</li>
          <li>All tamper-proof tags, labels, and seals must remain intact and unaltered.</li>
        </ul>
        <p>
          Before a return is approved, customers must share clear photographs of
          the product for verification. Returns will only be accepted after
          approval from the Delfee support team.
        </p>
      </>
    ),
  },
  {
    id: "non-returnable-items",
    heading: "Non-Returnable Items",
    body: (
      <>
        <p>The following products are not eligible for return or refund:</p>
        <ul>
          <li>Customized or engraved jewellery</li>
          <li>Made-to-order jewellery</li>
          <li>Personalized products</li>
          <li>Nose rings</li>
          <li>Earrings (due to hygiene reasons)</li>
          <li>Silver coins</li>
          <li>Festive or limited-edition collections</li>
          <li>Gift cards</li>
          <li>Promotional or complimentary items received with the order</li>
        </ul>
      </>
    ),
  },
  {
    id: "how-to-initiate-a-return",
    heading: "How to Initiate a Return",
    body: (
      <>
        <p>To request a return:</p>
        <ul>
          <li>Contact our customer support team within 7 days of delivery.</li>
          <li>Share your order number along with clear photographs of the product.</li>
          <li>Our team will review the request and confirm eligibility.</li>
          <li>Once approved, a return pickup will be arranged or shipping instructions will be provided.</li>
          <li>Securely pack the product in its original packaging with all documents included.</li>
        </ul>
        <p>
          Please do not ship the product without receiving confirmation from our
          support team.
        </p>
      </>
    ),
  },
  {
    id: "return-pickup-process",
    heading: "Return Pickup Process",
    body: (
      <ul>
        <li>Return pickup will be scheduled based on service availability in your location.</li>
        <li>If pickup service is unavailable, customers may be requested to ship the product to our designated return address.</li>
        <li>The jewellery will undergo a quality inspection once received.</li>
        <li>Returns that fail the quality inspection may be declined and shipped back to the customer.</li>
      </ul>
    ),
  },
  {
    id: "damaged-defective-or-incorrect-products",
    heading: "Damaged, Defective or Incorrect Products",
    body: (
      <>
        <p>If you receive a damaged, defective, or incorrect product:</p>
        <ul>
          <li>Notify us within 24 hours of delivery.</li>
          <li>An unboxing video recorded from the unopened package until the product is fully unpacked is mandatory for claim verification.</li>
          <li>Please also share clear photographs showing the issue.</li>
          <li>Claims raised without sufficient evidence may not be eligible for replacement or refund.</li>
        </ul>
        <p>
          Once verified, Delfee will arrange a replacement, exchange, or refund,
          as applicable.
        </p>
      </>
    ),
  },
  {
    id: "refund-policy",
    heading: "Refund Policy",
    body: (
      <>
        <p>After the returned product successfully passes our quality inspection:</p>
        <ul>
          <li>Refunds will be initiated within 5–7 business days.</li>
          <li>Refunds will be processed to the original payment method used during purchase.</li>
          <li>Depending on your bank or payment provider, it may take an additional 5–10 business days for the amount to reflect in your account.</li>
          <li>Customers may choose store credit, where applicable, if offered by Delfee.</li>
        </ul>
        <p>For Cash on Delivery (COD) orders:</p>
        <ul>
          <li>Any applicable COD handling charges are non-refundable.</li>
          <li>Refunds for COD orders will be processed via bank transfer or any other approved method after obtaining the customer's bank details.</li>
          <li>Any applicable COD collection or reverse logistics charges, where communicated, shall be borne by the customer.</li>
        </ul>
      </>
    ),
  },
  {
    id: "exchange-policy",
    heading: "Exchange Policy",
    body: (
      <>
        <p>We offer exchanges subject to the following conditions:</p>
        <ul>
          <li>Exchange requests must be raised within 7 days of delivery.</li>
          <li>Products must be unused, unworn, and returned with original packaging, invoice, certificates, and intact tags.</li>
          <li>Each order is eligible for one exchange only.</li>
          <li>Exchange requests are subject to successful quality inspection.</li>
          <li>If the exchanged product has a higher value, the customer must pay the price difference.</li>
          <li>If the exchanged product has a lower value, the balance amount will be refunded or issued as store credit, at Delfee's discretion.</li>
        </ul>
      </>
    ),
  },
  {
    id: "cancellation-policy",
    heading: "Cancellation Policy",
    body: (
      <ul>
        <li>Orders may be cancelled before dispatch without any cancellation charges.</li>
        <li>Once the order has been shipped, cancellations will not be accepted.</li>
        <li>Refunds for eligible cancelled orders will be processed to the original payment method.</li>
      </ul>
    ),
  },
  {
    id: "silver-price-precious-metal-value",
    heading: "Silver Price & Precious Metal Value",
    body: (
      <>
        <p>
          Delfee jewellery is crafted using genuine 925 Sterling Silver. Due to
          fluctuations in precious metal prices:
        </p>
        <ul>
          <li>Market price changes in silver will not affect the return or exchange eligibility of products purchased within the applicable policy period.</li>
          <li>Returns and exchanges will be based on the original purchase value and policy terms, not on current silver market prices.</li>
          <li>Unless specifically announced by Delfee, we do not offer a silver buyback or guaranteed exchange value program.</li>
        </ul>
      </>
    ),
  },
  {
    id: "quality-inspection",
    heading: "Quality Inspection",
    body: (
      <>
        <p>
          All returned products undergo a thorough quality inspection. Delfee
          reserves the right to reject returns if:
        </p>
        <ul>
          <li>The product shows signs of wear or usage.</li>
          <li>The product has been altered, resized, repaired, or damaged after delivery.</li>
          <li>Original packaging, invoice, certificates, or tags are missing.</li>
          <li>The return request does not comply with this policy.</li>
        </ul>
      </>
    ),
  },
  {
    id: "need-assistance",
    heading: "Need Assistance?",
    body: (
      <p>
        If you have any questions regarding returns, refunds, exchanges, or
        cancellations, please contact our customer support team. We will be happy
        to assist you and ensure a smooth shopping experience.
      </p>
    ),
  },
]

export default async function ReturnsPage() {
  const page = await getPage(SLUG)
  const cj = page?.content_json
  return (
    <LegalPage
      title={page?.title || "Return & Refund Policy"}
      eyebrow={cj?.eyebrow || "Customer Care"}
      intro={cj?.intro || "At Delfee, we take pride in crafting premium 925 Sterling Silver jewellery with exceptional quality and care. Your satisfaction is important to us. If you're not completely happy with your purchase, please review our Return & Refund Policy below."}
      lastUpdated={cj?.lastUpdated || LAST_UPDATED}
      sections={cmsSections(cj, SECTIONS)}
    />
  )
}
