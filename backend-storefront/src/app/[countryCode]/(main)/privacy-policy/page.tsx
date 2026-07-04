import { Metadata } from "next"

import { pageMetadata } from "@lib/util/content-seo"
import { BRAND } from "@lib/constants.brand"
import { getPage } from "@lib/data/cms"
import LegalPage, { LegalSection } from "@modules/content/components/legal-page"
import { cmsSections } from "@modules/content/components/legal-page/cms"

type Props = { params: Promise<{ countryCode: string }> }

const SLUG = "privacy-policy"
const LAST_UPDATED = "1 August 2026"

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
    id: "information-we-collect",
    heading: "Information We Collect",
    body: (
      <>
        <p>
          To provide you with a seamless shopping experience, we may collect the
          following information:
        </p>
        <p>
          <strong>Personal Information</strong>
        </p>
        <ul>
          <li>Full Name</li>
          <li>Mobile Number</li>
          <li>Email Address</li>
          <li>Shipping Address</li>
          <li>Billing Address</li>
        </ul>
        <p>
          <strong>Business Contact Information</strong>
        </p>
        <p>Delfee</p>
        <p>Shop No. 62, Sector 19C, Sector 19, Chandigarh – 160019</p>
        <p>Phone: +91 7888930585</p>
        <p>
          Email: <a href="mailto:enquire@delfee.in">enquire@delfee.in</a>
        </p>
        <p>
          <strong>Payment Information</strong>
        </p>
        <p>
          Payments made on our website are processed securely through trusted
          third-party payment gateways. Delfee does not store your complete
          debit card, credit card, UPI, net banking, or other payment
          credentials on its servers.
        </p>
        <p>
          <strong>Technical Information</strong>
        </p>
        <p>
          When you visit our website, we may automatically collect certain
          technical information, including:
        </p>
        <ul>
          <li>IP address</li>
          <li>Browser type</li>
          <li>Device information</li>
          <li>Operating system</li>
          <li>Website usage data</li>
          <li>Pages visited</li>
          <li>Time spent on the website</li>
          <li>Referral source</li>
        </ul>
      </>
    ),
  },
  {
    id: "why-we-collect-your-information",
    heading: "Why We Collect Your Information",
    body: (
      <>
        <p>We use your personal information for the following purposes:</p>
        <ul>
          <li>Processing and fulfilling your orders</li>
          <li>Delivering products to your preferred address</li>
          <li>Providing customer support and responding to your queries</li>
          <li>
            Sending order confirmations, invoices, shipping updates, and
            service-related notifications
          </li>
          <li>
            Preventing fraud, unauthorized transactions, and misuse of our
            services
          </li>
          <li>Improving our website, products, and customer experience</li>
          <li>
            Sending promotional offers, newsletters, and marketing
            communications (only where permitted or with your consent)
          </li>
          <li>Complying with applicable legal and regulatory obligations</li>
        </ul>
      </>
    ),
  },
  {
    id: "cookies-tracking-technologies",
    heading: "Cookies & Tracking Technologies",
    body: (
      <>
        <p>
          Our website uses cookies and similar technologies to improve your
          browsing experience. These technologies help us:
        </p>
        <ul>
          <li>
            Understand website traffic and user behaviour through analytics
            tools
          </li>
          <li>Remember your preferences and settings for future visits</li>
          <li>Improve website performance and functionality</li>
          <li>
            Deliver relevant advertisements through advertising pixels and
            remarketing tools
          </li>
        </ul>
        <p>
          You may disable cookies through your browser settings; however, some
          features of the website may not function properly.
        </p>
      </>
    ),
  },
  {
    id: "sharing-of-information",
    heading: "Sharing of Information",
    body: (
      <>
        <p>
          We value your privacy and do not sell your personal information.
          However, we may share your information with trusted third parties
          where necessary to provide our services, including:
        </p>
        <ul>
          <li>Shipping and logistics partners for order delivery</li>
          <li>Secure payment gateway providers for payment processing</li>
          <li>Marketing and communication service providers</li>
          <li>Technology and website service providers</li>
          <li>
            Government authorities, law enforcement agencies, regulatory bodies,
            or courts when required under applicable law
          </li>
        </ul>
        <p>
          All third-party service providers are expected to maintain appropriate
          confidentiality and security standards.
        </p>
      </>
    ),
  },
  {
    id: "data-security",
    heading: "Data Security",
    body: (
      <>
        <p>
          Protecting your personal information is one of our highest priorities.
          We implement reasonable technical and organizational security
          measures, including:
        </p>
        <ul>
          <li>Industry-standard encryption for data transmission</li>
          <li>Secure payment processing through trusted payment gateways</li>
          <li>
            Restricted access to customer information on a need-to-know basis
          </li>
          <li>Regular security monitoring and system safeguards</li>
        </ul>
        <p>
          While we strive to protect your information, no method of internet
          transmission or electronic storage can be guaranteed to be completely
          secure.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    heading: "Your Rights",
    body: (
      <>
        <p>Subject to applicable laws, you may have the right to:</p>
        <ul>
          <li>Access the personal information we hold about you</li>
          <li>Request correction or updating of inaccurate information</li>
          <li>
            Request deletion of your personal information, subject to legal or
            regulatory retention requirements
          </li>
          <li>Withdraw consent where processing is based on consent</li>
          <li>
            Opt out of promotional emails, SMS, WhatsApp messages, or marketing
            communications at any time
          </li>
        </ul>
        <p>
          To exercise any of these rights, please contact us using the details
          provided at the end of this Privacy Policy.
        </p>
      </>
    ),
  },
  {
    id: "childrens-privacy",
    heading: "Children's Privacy",
    body: (
      <p>
        We do not knowingly collect personal information from children. If we
        become aware that personal information of a minor has been collected
        without appropriate authorization, we will take reasonable steps to
        delete such information.
      </p>
    ),
  },
  {
    id: "data-retention",
    heading: "Data Retention",
    body: (
      <p>
        We retain your personal information only for as long as necessary to
        fulfil the purposes outlined in this Privacy Policy or as required by
        applicable law. If you have subscribed to our newsletter or created an
        account on our website, your information may be retained until you
        unsubscribe, request deletion (subject to legal obligations), or your
        account is no longer active. Certain transaction records may be retained
        for longer periods where required under taxation, accounting, or other
        legal obligations.
      </p>
    ),
  },
  {
    id: "third-party-links",
    heading: "Third-Party Links",
    body: (
      <p>
        Our website may contain links to third-party websites, including social
        media platforms and external services. Please note that Delfee is not
        responsible for the privacy practices, security, or content of these
        external websites. We encourage you to review their respective privacy
        policies before sharing any personal information.
      </p>
    ),
  },
  {
    id: "compliance-with-indian-laws",
    heading: "Compliance with Indian Laws",
    body: (
      <>
        <p>
          Delfee is committed to handling personal data responsibly and in
          accordance with applicable Indian laws, including:
        </p>
        <ul>
          <li>
            The Digital Personal Data Protection Act, 2023 (DPDP Act)
          </li>
          <li>
            The Information Technology Act, 2000, along with applicable rules and
            regulations
          </li>
        </ul>
        <p>
          We continually review our data protection practices to maintain
          compliance with evolving legal requirements.
        </p>
      </>
    ),
  },
  {
    id: "changes-to-this-privacy-policy",
    heading: "Changes to This Privacy Policy",
    body: (
      <p>
        Delfee reserves the right to update or modify this Privacy Policy at any
        time. Any changes will be posted on this page along with the revised
        effective date. Continued use of our website after such updates
        constitutes your acceptance of the revised Privacy Policy.
      </p>
    ),
  },
  {
    id: "contact-us",
    heading: "Contact Us",
    body: (
      <>
        <p>
          If you have any questions, concerns, or requests regarding this Privacy
          Policy or the way your personal information is handled, please contact
          our Privacy Officer:
        </p>
        <p>Privacy Officer: Rajat Jain</p>
        <p>Vardhman Jewellers (Delfee)</p>
        <p>Shop No. 62, Sector 19C, Sector 19, Chandigarh – 160019</p>
        <p>Phone: +91 7888930585</p>
        <p>
          Email: <a href="mailto:enquire@delfee.in">enquire@delfee.in</a>
        </p>
        <p>
          We will make every reasonable effort to respond to your privacy-related
          queries on time.
        </p>
      </>
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
      intro={cj?.intro || `At Delfee, your privacy is important to us. This Privacy Policy explains how we collect, use, store, disclose, and protect your personal information when you visit our website or purchase our products. By accessing or using our website, you agree to the practices described in this Privacy Policy.`}
      lastUpdated={cj?.lastUpdated || LAST_UPDATED}
      sections={cmsSections(cj, SECTIONS)}
    />
  )
}
