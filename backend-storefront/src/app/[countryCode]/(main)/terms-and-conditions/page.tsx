import { Metadata } from "next"

import { pageMetadata } from "@lib/util/content-seo"
import { BRAND } from "@lib/constants.brand"
import { getPage } from "@lib/data/cms"
import LegalPage, { LegalSection } from "@modules/content/components/legal-page"
import { cmsSections } from "@modules/content/components/legal-page/cms"

type Props = { params: Promise<{ countryCode: string }> }

const SLUG = "terms-and-conditions"
const LAST_UPDATED = "22 May 2026"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  const page = await getPage(SLUG)
  return pageMetadata({
    countryCode,
    path: `/${SLUG}`,
    title: page?.meta_title || page?.title || "Terms & Conditions",
    description:
      page?.meta_description ||
      `The terms that govern your use of the ${BRAND.name} website and your purchases with us.`,
  })
}

const SECTIONS: LegalSection[] = [
  {
    id: "acceptance",
    heading: "Acceptance of Terms",
    body: (
      <p>
        Welcome to {BRAND.name}. By accessing or using our website and placing
        an order, you agree to be bound by these Terms &amp; Conditions. If you
        do not agree with any part of these terms, please do not use our
        website.
      </p>
    ),
  },
  {
    id: "eligibility",
    heading: "Eligibility",
    body: (
      <p>
        You must be at least 18 years of age, or accessing the website under the
        supervision of a parent or legal guardian, to make a purchase. By
        placing an order you confirm that the information you provide is
        accurate and complete.
      </p>
    ),
  },
  {
    id: "account",
    heading: "Account Registration",
    body: (
      <p>
        You are responsible for maintaining the confidentiality of your account
        credentials and for all activity under your account. Please notify us
        immediately of any unauthorised use. We may suspend or terminate
        accounts that violate these terms.
      </p>
    ),
  },
  {
    id: "products-pricing",
    heading: "Products & Pricing",
    body: (
      <>
        <p>
          We make every effort to display our products and prices accurately.
          However:
        </p>
        <ul>
          <li>
            Product images are for illustration; slight variation is natural in
            handcrafted jewellery.
          </li>
          <li>
            All prices are listed in Indian Rupees (INR) and are inclusive of
            applicable taxes unless stated otherwise.
          </li>
          <li>
            We reserve the right to correct pricing errors and to change prices
            without prior notice.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "orders-payment",
    heading: "Orders & Payment",
    body: (
      <p>
        An order is confirmed once payment is successfully received and you
        receive an order confirmation. We reserve the right to refuse or cancel
        any order, including in cases of suspected fraud, pricing errors, or
        stock unavailability. In such cases, any amount paid will be refunded.
      </p>
    ),
  },
  {
    id: "shipping-returns",
    heading: "Shipping, Returns & Cancellations",
    body: (
      <p>
        Delivery timelines, charges and return eligibility are described in our{" "}
        <a href="/shipping-policy">Shipping Policy</a> and{" "}
        <a href="/returns-and-exchange">Returns &amp; Exchange Policy</a>, which
        form part of these Terms.
      </p>
    ),
  },
  {
    id: "intellectual-property",
    heading: "Intellectual Property",
    body: (
      <p>
        All content on this website — including designs, images, logos, text and
        graphics — is the property of {BRAND.name} and is protected by
        applicable intellectual property laws. You may not reproduce, distribute
        or use any content without our written permission.
      </p>
    ),
  },
  {
    id: "prohibited-use",
    heading: "Prohibited Use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Use the website for any unlawful or fraudulent purpose.</li>
          <li>
            Attempt to gain unauthorised access to our systems or other users'
            accounts.
          </li>
          <li>
            Interfere with the proper working of the website or introduce
            harmful code.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "liability",
    heading: "Limitation of Liability",
    body: (
      <p>
        {BRAND.name} shall not be liable for any indirect, incidental or
        consequential damages arising from the use of our website or products,
        to the maximum extent permitted by law. Our total liability for any
        claim shall not exceed the amount paid for the relevant order.
      </p>
    ),
  },
  {
    id: "governing-law",
    heading: "Governing Law",
    body: (
      <p>
        These Terms are governed by and construed in accordance with the laws of
        India. Any disputes shall be subject to the exclusive jurisdiction of
        the competent courts in India.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact Us",
    body: (
      <p>
        For any questions about these Terms &amp; Conditions, contact us at{" "}
        <a href="mailto:support@delfee.com">support@delfee.com</a>.
      </p>
    ),
  },
]

export default async function TermsPage() {
  const page = await getPage(SLUG)
  const cj = page?.content_json
  return (
    <LegalPage
      title={page?.title || "Terms & Conditions"}
      eyebrow={cj?.eyebrow || "Legal"}
      intro={cj?.intro || `Please read these terms carefully — they govern your use of ${BRAND.name} and your purchases with us.`}
      lastUpdated={cj?.lastUpdated || LAST_UPDATED}
      sections={cmsSections(cj, SECTIONS)}
    />
  )
}
