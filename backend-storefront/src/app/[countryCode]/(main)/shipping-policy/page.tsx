import { Metadata } from "next"

import { pageMetadata } from "@lib/util/content-seo"
import { BRAND } from "@lib/constants.brand"
import { getPage } from "@lib/data/cms"
import LegalPage, { LegalSection } from "@modules/content/components/legal-page"
import { cmsSections } from "@modules/content/components/legal-page/cms"

type Props = { params: Promise<{ countryCode: string }> }

const SLUG = "shipping-policy"
const LAST_UPDATED = "1 August 2026"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  const page = await getPage(SLUG)
  return pageMetadata({
    countryCode,
    path: `/${SLUG}`,
    title: page?.meta_title || page?.title || "Shipping Policy",
    description:
      page?.meta_description ||
      `Delivery timelines, charges and tracking for ${BRAND.name} orders — domestic and international shipping explained.`,
  })
}

const SECTIONS: LegalSection[] = [
  {
    id: "shipping-coverage",
    heading: "Shipping Coverage",
    body: (
      <>
        <p>
          <strong>Domestic Shipping</strong>
        </p>
        <p>
          We currently ship across all serviceable locations within India
          through our trusted logistics partners.
        </p>
        <p>
          <strong>International Shipping</strong>
        </p>
        <p>
          At present, international shipping is not available. We are working
          towards expanding our services globally and will update our customers
          once international deliveries begin.
        </p>
      </>
    ),
  },
  {
    id: "order-processing-time",
    heading: "Order Processing Time",
    body: (
      <>
        <p>
          Every Delfee piece is crafted and prepared with precision. Processing
          times may vary depending on the product.
        </p>
        <p>
          <strong>Ready-to-Ship Products</strong>
        </p>
        <p>
          Ready-to-ship jewellery is typically processed and dispatched within
          10–15 business days after order confirmation.
        </p>
        <p>
          <strong>Made-to-Order Products</strong>
        </p>
        <p>
          Made-to-order jewellery is handcrafted according to the selected
          design and detailing. Processing and dispatch generally take 10–15
          business days, depending on the complexity of the design.
        </p>
        <p>
          <strong>Festival & Sale Periods</strong>
        </p>
        <p>
          During festive seasons, promotional campaigns, or high-demand sale
          periods, order processing and dispatch may take slightly longer than
          usual. We appreciate your patience during these busy periods.
        </p>
      </>
    ),
  },
  {
    id: "estimated-delivery-timelines",
    heading: "Estimated Delivery Timelines",
    body: (
      <>
        <p>
          Once your order has been dispatched, the estimated delivery timelines
          are as follows:
        </p>
        <ul>
          <li>Metro Cities: Approximately 7-10 business days</li>
          <li>Tier-2 & Tier-3 Cities: Approximately 7-10 business days</li>
          <li>
            Remote & Non-Serviceable Areas: Approximately 7–15 business days,
            depending on courier availability.
          </li>
        </ul>
        <p>
          Please note that these are estimated timelines and may vary due to
          logistics or unforeseen circumstances.
        </p>
      </>
    ),
  },
  {
    id: "shipping-charges",
    heading: "Shipping Charges",
    body: (
      <>
        <p>
          <strong>Free Standard Shipping</strong>
        </p>
        <p>
          We offer FREE standard shipping on all orders valued above ₹5,000
          within India.
        </p>
        <p>
          <strong>Orders Below ₹5,000</strong>
        </p>
        <p>
          Shipping charges, if applicable, will be calculated and displayed
          during checkout.
        </p>
        <p>
          <strong>Express Shipping</strong>
        </p>
        <p>
          Express shipping may be available for select locations at an
          additional charge. The applicable fee will be displayed during
          checkout, subject to service availability.
        </p>
      </>
    ),
  },
  {
    id: "secure-packaging",
    heading: "Secure Packaging",
    body: (
      <>
        <p>
          Your jewellery deserves the highest level of protection during
          transit. To ensure safe delivery:
        </p>
        <ul>
          <li>Every order is packed in secure, tamper-proof packaging.</li>
          <li>
            Packaging is designed to protect the jewellery from damage during
            transportation.
          </li>
          <li>
            For added security and privacy, all shipments are sent in discreet
            outer packaging without revealing the contents.
          </li>
        </ul>
        <p>
          Please inspect the package before accepting delivery. If the package
          appears damaged or tampered with, kindly inform the delivery partner
          immediately and contact our customer support team.
        </p>
      </>
    ),
  },
  {
    id: "order-tracking",
    heading: "Order Tracking",
    body: (
      <>
        <p>Once your order is dispatched:</p>
        <ul>
          <li>
            You will receive your tracking number via your registered email
            address and/or mobile number.
          </li>
          <li>
            Orders can be tracked directly through the Delfee website or via our
            logistics partner, Shiprocket.
          </li>
          <li>
            Tracking information may take up to 24 hours after dispatch to become
            active.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "delivery-requirements",
    heading: "Delivery Requirements",
    body: (
      <>
        <p>To ensure secure delivery of your valuable jewellery:</p>
        <ul>
          <li>OTP verification may be required at the time of delivery.</li>
          <li>
            The recipient may be required to provide a signature as proof of
            delivery.
          </li>
          <li>
            For select high-value orders, Delfee or the delivery partner may
            request a valid government-issued photo ID before handing over the
            shipment.
          </li>
        </ul>
        <p>
          These verification measures are implemented solely for the security of
          our customers.
        </p>
      </>
    ),
  },
  {
    id: "failed-delivery-attempts",
    heading: "Failed Delivery Attempts",
    body: (
      <>
        <p>
          Our courier partners generally make 1–2 delivery attempts, depending
          on the circumstances and courier policies. If delivery cannot be
          completed due to:
        </p>
        <ul>
          <li>Incorrect or incomplete address</li>
          <li>Recipient unavailable</li>
          <li>Failed verification</li>
          <li>Refusal to accept the shipment</li>
        </ul>
        <p>
          the package may be returned to our warehouse (Return-to-Origin).
          Re-shipping charges, if applicable, may be payable by the customer
          before the order is dispatched again.
        </p>
      </>
    ),
  },
  {
    id: "insurance-risk",
    heading: "Insurance & Risk",
    body: (
      <ul>
        <li>
          All Delfee shipments are securely packed and insured during transit.
        </li>
        <li>
          The responsibility for the shipment remains with Delfee until the
          order has been successfully delivered and acknowledged by the customer
          or the authorized recipient.
        </li>
        <li>
          Once delivery has been successfully completed, the responsibility for
          the product transfers to the customer.
        </li>
      </ul>
    ),
  },
  {
    id: "force-majeure",
    heading: "Force Majeure",
    body: (
      <>
        <p>
          While we strive to deliver every order within the estimated timeline,
          certain situations beyond our control may cause unavoidable delays,
          including but not limited to:
        </p>
        <ul>
          <li>Natural disasters</li>
          <li>Extreme weather conditions</li>
          <li>Government restrictions</li>
          <li>Public holidays</li>
          <li>Transport disruptions</li>
          <li>Strikes or labour shortages</li>
          <li>Pandemic-related restrictions</li>
          <li>Civil unrest or other unforeseen events</li>
        </ul>
        <p>
          In such cases, delivery timelines may be extended. Delfee will make
          every reasonable effort to keep customers informed and ensure delivery
          at the earliest possible opportunity.
        </p>
      </>
    ),
  },
]

export default async function ShippingPolicyPage() {
  const page = await getPage(SLUG)
  const cj = page?.content_json
  return (
    <LegalPage
      title={page?.title || "Shipping Policy"}
      eyebrow={cj?.eyebrow || "Customer Care"}
      intro={cj?.intro || "At Delfee, we are committed to delivering your 925 Sterling Silver jewellery safely, securely, and on time. Every order is carefully packed and shipped with the utmost care to ensure it reaches you in perfect condition."}
      lastUpdated={cj?.lastUpdated || LAST_UPDATED}
      sections={cmsSections(cj, SECTIONS)}
    />
  )
}
