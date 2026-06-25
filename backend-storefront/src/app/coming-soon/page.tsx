import type { Metadata } from "next"

import { BRAND } from "@lib/constants.brand"
import { getBaseURL } from "@lib/util/env"
import ComingSoonClient from "./client"

const TITLE = `Launching soon — ${BRAND.name}`
const DESCRIPTION =
  "Handcrafted fine jewellery — 925 silver, anti-tarnish. " +
  "Heirloom designs made in India. Our store opens this season."
const OG_IMAGE = "/images/coming-soon_2.png"

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  applicationName: BRAND.name,
  keywords: [
    "fine jewellery",
    "silver jewellery",
    "925 silver",
    "anti-tarnish jewellery",
    "handcrafted jewellery",
    "Indian jewellery",
    BRAND.name,
  ],
  authors: [{ name: BRAND.name }],
  creator: BRAND.name,
  publisher: BRAND.name,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: { canonical: "/coming-soon" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: TITLE,
    description: DESCRIPTION,
    url: "/coming-soon",
    locale: "en_IN",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${BRAND.name} — ${BRAND.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  formatDetection: { telephone: false, email: false, address: false },
}

export default function ComingSoonPage() {
  const baseURL = getBaseURL()
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${baseURL}/#organization`,
        name: BRAND.name,
        url: baseURL,
        logo: `${baseURL}/images/df%20logo%20-%20dark.png`,
        description: BRAND.description,
      },
      {
        "@type": "WebSite",
        "@id": `${baseURL}/#website`,
        url: baseURL,
        name: BRAND.name,
        description: BRAND.description,
        publisher: { "@id": `${baseURL}/#organization` },
        inLanguage: "en-IN",
      },
      {
        "@type": "WebPage",
        "@id": `${baseURL}/coming-soon#webpage`,
        url: `${baseURL}/coming-soon`,
        name: TITLE,
        description: DESCRIPTION,
        isPartOf: { "@id": `${baseURL}/#website` },
        about: { "@id": `${baseURL}/#organization` },
        inLanguage: "en-IN",
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ComingSoonClient brandName={BRAND.name} />
    </>
  )
}
