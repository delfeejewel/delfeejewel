import { Metadata } from "next"

import { pageMetadata } from "@lib/util/content-seo"
import { BRAND } from "@lib/constants.brand"
import { getPage } from "@lib/data/cms"
import LegalPage, { LegalSection } from "@modules/content/components/legal-page"
import { cmsSections } from "@modules/content/components/legal-page/cms"

type Props = { params: Promise<{ countryCode: string }> }

const SLUG = "shipping-policy"
const LAST_UPDATED = "22 May 2026"

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
    id: "overview",
    heading: "Overview",
    body: (
      <p>
        We take great care in packing and dispatching every order. This policy
        explains how long delivery takes, what it costs, and how to track your
        package.
      </p>
    ),
  },
  {
    id: "processing",
    heading: "Order Processing Time",
    body: (
      <p>
        Orders are processed within <strong>1–2 business days</strong>.
        Made-to-order and customised pieces may require additional time, which
        will be indicated on the product page. You will receive a confirmation
        email once your order is dispatched.
      </p>
    ),
  },
  {
    id: "domestic",
    heading: "Domestic Shipping (India)",
    body: (
      <>
        <ul>
          <li>
            <strong>Metro cities:</strong> typically 3–5 business days after
            dispatch.
          </li>
          <li>
            <strong>Other locations:</strong> typically 5–8 business days after
            dispatch.
          </li>
          <li>
            All domestic orders are shipped with insured, trackable courier
            partners.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "international",
    heading: "International Shipping",
    body: (
      <p>
        We ship to select international destinations. Estimated delivery is{" "}
        <strong>10–18 business days</strong> after dispatch, depending on the
        location. Please note that any customs duties, import taxes or fees
        levied by the destination country are the responsibility of the
        recipient.
      </p>
    ),
  },
  {
    id: "charges",
    heading: "Shipping Charges",
    body: (
      <>
        <ul>
          <li>
            <strong>Free standard shipping</strong> on domestic orders above
            ₹999.
          </li>
          <li>
            A nominal shipping fee applies to domestic orders below ₹999,
            calculated at checkout.
          </li>
          <li>
            International shipping charges are calculated at checkout based on
            destination and order weight.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "tracking",
    heading: "Order Tracking",
    body: (
      <p>
        Once your order ships, we'll email you a tracking link. You can also
        view live status anytime under{" "}
        <a href="/account/orders">My Orders</a> in your account.
      </p>
    ),
  },
  {
    id: "delays",
    heading: "Delays & Exceptions",
    body: (
      <p>
        Delivery timelines are estimates and may be affected by factors outside
        our control — such as weather, courier delays, public holidays or
        regional restrictions. We appreciate your patience and will keep you
        informed of any significant delays.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Need Help With a Delivery?",
    body: (
      <p>
        If you have a question about your shipment, email{" "}
        <a href="mailto:support@delfee.com">support@delfee.com</a> with your
        order number and we'll look into it right away.
      </p>
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
      intro={cj?.intro || "Everything you need to know about how and when your order reaches you."}
      lastUpdated={cj?.lastUpdated || LAST_UPDATED}
      sections={cmsSections(cj, SECTIONS)}
    />
  )
}
