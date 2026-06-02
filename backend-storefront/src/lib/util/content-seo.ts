import { Metadata } from "next"
import { BRAND } from "@lib/constants.brand"
import { getBaseURL } from "./env"

type PageMetaInput = {
  countryCode: string
  /** Path after the country code, e.g. "/about" */
  path: string
  title: string
  description: string
  noindex?: boolean
}

/**
 * Standardized SEO metadata for content pages — canonical URL, OpenGraph,
 * Twitter card and robots, all derived from the brand config.
 */
export function pageMetadata({
  countryCode,
  path,
  title,
  description,
  noindex,
}: PageMetaInput): Metadata {
  const url = `${getBaseURL()}/${countryCode}${path}`
  const fullTitle = `${title} | ${BRAND.name}`

  return {
    title: fullTitle,
    description,
    alternates: { canonical: url },
    robots: noindex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
    openGraph: {
      type: "website",
      title: fullTitle,
      description,
      url,
      siteName: BRAND.name,
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
  }
}

/** Renders a JSON-LD structured-data block. */
export function jsonLd(data: Record<string, unknown>) {
  return {
    __html: JSON.stringify(data),
  }
}
