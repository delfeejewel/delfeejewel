import { Metadata } from "next"

import { pageMetadata } from "@lib/util/content-seo"
import { BRAND } from "@lib/constants.brand"
import { getPage } from "@lib/data/cms"
import LegalPage, { LegalSection } from "@modules/content/components/legal-page"
import { cmsSections } from "@modules/content/components/legal-page/cms"

type Props = { params: Promise<{ countryCode: string }> }

const SLUG = "privacy-policy"
const LAST_UPDATED = "22 May 2026"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  const page = await getPage(SLUG)
  return pageMetadata({
    countryCode,
    path: `/${SLUG}`,
    title: page?.meta_title || page?.title || "Privacy Policy",
    description:
      page?.meta_description ||
      `How ${BRAND.name} collects, uses and protects your personal information when you shop with us.`,
  })
}

const SECTIONS: LegalSection[] = [
  {
    id: "introduction",
    heading: "Introduction",
    body: (
      <>
        <p>
          {BRAND.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;)
          respects your privacy and is committed to protecting your personal
          data. This Privacy Policy explains what information we collect, how we
          use it, and the choices you have when you visit our website or place
          an order.
        </p>
        <p>
          By using our website and services, you consent to the practices
          described in this policy.
        </p>
      </>
    ),
  },
  {
    id: "information-we-collect",
    heading: "Information We Collect",
    body: (
      <>
        <p>We collect the following types of information:</p>
        <ul>
          <li>
            <strong>Account &amp; contact details</strong> — name, email
            address, phone number and password.
          </li>
          <li>
            <strong>Order information</strong> — billing and shipping addresses,
            items purchased and order history.
          </li>
          <li>
            <strong>Payment information</strong> — processed securely by our
            payment partners; we do not store full card details on our servers.
          </li>
          <li>
            <strong>Usage data</strong> — pages viewed, device and browser
            information, and interactions collected through cookies.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "how-we-use",
    heading: "How We Use Your Information",
    body: (
      <>
        <p>We use your information to:</p>
        <ul>
          <li>Process, fulfil and deliver your orders.</li>
          <li>Provide customer support and respond to your enquiries.</li>
          <li>Send order updates, and — with your consent — marketing emails.</li>
          <li>Improve our products, website and shopping experience.</li>
          <li>Detect and prevent fraud, and comply with legal obligations.</li>
        </ul>
      </>
    ),
  },
  {
    id: "cookies",
    heading: "Cookies & Tracking",
    body: (
      <>
        <p>
          We use cookies and similar technologies to keep you signed in,
          remember your cart, understand how the site is used, and personalise
          content. You can control cookies through your browser settings, though
          disabling them may affect site functionality.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    heading: "Sharing & Disclosure",
    body: (
      <>
        <p>
          We do not sell your personal information. We share data only with
          trusted parties who help us operate our business, including:
        </p>
        <ul>
          <li>Payment gateways to process transactions.</li>
          <li>Logistics and courier partners to deliver your orders.</li>
          <li>Service providers for email, analytics and hosting.</li>
          <li>Authorities, where required by law.</li>
        </ul>
      </>
    ),
  },
  {
    id: "data-security",
    heading: "Data Security",
    body: (
      <p>
        We use industry-standard safeguards to protect your information,
        including encrypted connections and restricted access. While no method
        of transmission over the internet is completely secure, we work
        continuously to keep your data safe.
      </p>
    ),
  },
  {
    id: "your-rights",
    heading: "Your Rights",
    body: (
      <>
        <p>
          You have the right to access, correct or delete your personal data,
          and to opt out of marketing communications at any time. To exercise
          these rights, contact us at{" "}
          <a href="mailto:support@delfee.com">support@delfee.com</a>.
        </p>
      </>
    ),
  },
  {
    id: "childrens-privacy",
    heading: "Children's Privacy",
    body: (
      <p>
        Our website is not intended for individuals under the age of 18. We do
        not knowingly collect personal information from children. If you believe
        a minor has provided us data, please contact us so we can remove it.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to This Policy",
    body: (
      <p>
        We may update this Privacy Policy from time to time. Any changes will be
        posted on this page with a revised &ldquo;Last updated&rdquo; date. We
        encourage you to review it periodically.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact Us",
    body: (
      <p>
        If you have questions about this Privacy Policy or how we handle your
        data, email us at{" "}
        <a href="mailto:support@delfee.com">support@delfee.com</a>.
      </p>
    ),
  },
]

export default async function PrivacyPolicyPage() {
  const page = await getPage(SLUG)
  const cj = page?.content_json
  return (
    <LegalPage
      title={page?.title || "Privacy Policy"}
      eyebrow={cj?.eyebrow || "Legal"}
      intro={cj?.intro || `Your privacy matters to us. This policy explains how ${BRAND.name} handles your personal information.`}
      lastUpdated={cj?.lastUpdated || LAST_UPDATED}
      sections={cmsSections(cj, SECTIONS)}
    />
  )
}
