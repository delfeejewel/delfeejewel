import { Metadata } from "next"

import { pageMetadata } from "@lib/util/content-seo"
import { BRAND } from "@lib/constants.brand"
import { getPage } from "@lib/data/cms"
import LegalPage, { LegalSection } from "@modules/content/components/legal-page"
import { cmsSections } from "@modules/content/components/legal-page/cms"

type Props = { params: Promise<{ countryCode: string }> }

const SLUG = "terms-and-conditions"
const LAST_UPDATED = "1 August 2026"

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
    id: "acceptance-of-terms",
    heading: "Acceptance of Terms",
    body: (
      <p>
        By using the Delfee website, you acknowledge that you have read,
        understood, and agreed to these Terms &amp; Conditions, along with our
        Privacy Policy, Shipping Policy, and Return &amp; Refund Policy.
      </p>
    ),
  },
  {
    id: "eligibility",
    heading: "Eligibility",
    body: (
      <>
        <p>To use our website or place an order:</p>
        <ul>
          <li>
            You must be at least 8 years of age or access the website under the
            supervision of a parent or legal guardian.
          </li>
          <li>
            By placing an order, you represent that you have the legal capacity
            to enter into a binding contract under applicable Indian laws.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "product-information",
    heading: "Product Information",
    body: (
      <>
        <p>
          We strive to ensure that all product information displayed on our
          website is accurate and up to date. However:
        </p>
        <ul>
          <li>
            Product descriptions, specifications, and images are provided for
            informational purposes.
          </li>
          <li>
            Minor variations in dimensions or weight may occur due to the
            handcrafted nature of jewellery.
          </li>
          <li>
            Natural gemstones may vary in colour, texture, inclusions, and
            appearance, making every piece unique.
          </li>
          <li>
            Product colours may appear slightly different due to screen
            settings, lighting conditions, or device displays.
          </li>
        </ul>
        <p>These variations shall not be considered manufacturing defects.</p>
      </>
    ),
  },
  {
    id: "pricing",
    heading: "Pricing",
    body: (
      <>
        <p>
          All prices displayed on the website are subject to change without
          prior notice.
        </p>
        <ul>
          <li>Prices are displayed in Indian Rupees (INR).</li>
          <li>
            Applicable GST will be charged as per Indian tax laws. Where
            indicated, prices are inclusive of GST.
          </li>
          <li>
            In the event of an incorrect price due to technical, typographical,
            or system errors, Delfee reserves the right to cancel the order and
            refund any amount received.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "orders",
    heading: "Orders",
    body: (
      <>
        <p>
          Placing an order does not constitute acceptance by Delfee. We reserve
          the right to:
        </p>
        <ul>
          <li>Accept or reject any order at our sole discretion.</li>
          <li>
            Cancel orders suspected to be fraudulent, unauthorized, or placed
            with malicious intent.
          </li>
          <li>
            Request additional verification, including identity confirmation,
            address verification, or payment authentication before processing an
            order.
          </li>
        </ul>
        <p>
          If an order is cancelled after payment has been received, the
          applicable refund will be processed to the original payment method.
        </p>
      </>
    ),
  },
  {
    id: "payment-terms",
    heading: "Payment Terms",
    body: (
      <>
        <p>
          We accept payments through secure and authorized payment gateways
          using available payment methods, including:
        </p>
        <ul>
          <li>Credit Cards</li>
          <li>Debit Cards</li>
          <li>UPI</li>
          <li>Net Banking</li>
          <li>Digital Wallets</li>
          <li>Cash on Delivery (where available)</li>
        </ul>
        <p>
          Currently, EMI payment options are not available. All online payments
          are processed through secure third-party payment gateway providers.
          Delfee does not store your complete payment card details.
        </p>
      </>
    ),
  },
  {
    id: "intellectual-property",
    heading: "Intellectual Property",
    body: (
      <>
        <p>
          Unless otherwise stated, all content available on this website,
          including but not limited to:
        </p>
        <ul>
          <li>Product images</li>
          <li>Jewellery designs</li>
          <li>Logos</li>
          <li>Brand name</li>
          <li>Graphics</li>
          <li>Text</li>
          <li>Videos</li>
          <li>Website layout</li>
          <li>Icons</li>
        </ul>
        <p>
          are the exclusive intellectual property of Delfee or its licensors. No
          content may be copied, reproduced, modified, distributed, or
          commercially used without prior written permission from Delfee.
        </p>
      </>
    ),
  },
  {
    id: "user-conduct",
    heading: "User Conduct",
    body: (
      <>
        <p>While using our website, you agree not to:</p>
        <ul>
          <li>Provide false or misleading information.</li>
          <li>Attempt unauthorized access to our systems.</li>
          <li>Engage in fraudulent transactions.</li>
          <li>Interfere with the operation or security of the website.</li>
          <li>Upload malicious software or harmful code.</li>
          <li>Use the website for unlawful or prohibited purposes.</li>
        </ul>
        <p>
          Violation of these Terms may result in suspension or termination of
          access to our services.
        </p>
      </>
    ),
  },
  {
    id: "limitation-of-liability",
    heading: "Limitation of Liability",
    body: (
      <>
        <p>
          To the fullest extent permitted under applicable law, Delfee shall not
          be liable for:
        </p>
        <ul>
          <li>Any indirect, incidental, special, or consequential damages.</li>
          <li>
            Loss of profits, business opportunities, or data arising from the
            use of our website or products.
          </li>
          <li>
            Delays caused by courier services, force majeure events, or
            circumstances beyond our reasonable control.
          </li>
        </ul>
        <p>
          Our maximum liability, if any, shall be limited to the amount paid by
          the customer for the concerned order.
        </p>
      </>
    ),
  },
  {
    id: "governing-law-jurisdiction",
    heading: "Governing Law & Jurisdiction",
    body: (
      <p>
        These Terms shall be governed and interpreted in accordance with the
        laws of India. Any dispute arising out of or relating to these Terms
        shall be subject to the exclusive jurisdiction of the competent courts
        in Chandigarh, India.
      </p>
    ),
  },
  {
    id: "amendments",
    heading: "Amendments",
    body: (
      <p>
        Delfee reserves the right to modify, update, or revise these Terms &amp;
        Conditions at any time without prior notice. The revised Terms will
        become effective immediately upon publication on the website. Continued
        use of the website constitutes acceptance of the updated Terms.
      </p>
    ),
  },
  {
    id: "contact-us",
    heading: "Contact Us",
    body: (
      <>
        <p>
          For any questions regarding these Terms &amp; Conditions, please
          contact us:
        </p>
        <p>
          Delfee (Vardhman Jewellers)
          <br />
          Shop No. 62, Sector 19C, Sector 19, Chandigarh – 160019
          <br />
          Phone: +91 9877686053
          <br />
          Email: <a href="mailto:enquire@delfee.in">enquire@delfee.in</a>
        </p>
      </>
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
      intro={cj?.intro || "Welcome to Delfee, a brand of Vardhman Jewellers. These Terms & Conditions (\"Terms\") govern your access to and use of our website and the purchase of our products. By accessing, browsing, or placing an order through our website, you agree to be bound by these Terms. If you do not agree with any part of these Terms, please refrain from using our website."}
      lastUpdated={cj?.lastUpdated || LAST_UPDATED}
      sections={cmsSections(cj, SECTIONS)}
    />
  )
}
