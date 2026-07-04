/**
 * Brand configuration — change these values to update the brand name
 * across the entire storefront. All components import from here.
 */

export const BRAND = {
  name: "Delfee",
  /** Registered legal entity behind the Delfee brand. */
  legalName: "Vardhman Jewellers",
  tagline: "Handcrafted Fine Jewellery",
  description:
    "Discover handcrafted rings, necklaces, earrings and bracelets. Timeless jewellery in gold, silver and precious stones, designed to be treasured forever.",
  copyright: (year: number) => `© ${year} Delfee. All rights reserved.`,
  /**
   * Real business contact details — single source of truth for the contact
   * page, footer and policy pages. Required on-site by payment gateways
   * (Razorpay) for KYC / website verification.
   */
  contact: {
    addressLines: ["Shop No. 62, Sector 19C", "Sector 19, Chandigarh – 160019"],
    addressFull: "Shop No. 62, Sector 19C, Sector 19, Chandigarh – 160019",
    phone: "+91 7888930585",
    phoneHref: "tel:+917888930585",
    email: "enquire@delfee.in",
  },
  meta: {
    title: "Delfee | Handcrafted Fine Jewellery",
    productSuffix: "Delfee",
    categorySuffix: "Delfee",
    collectionSuffix: "Delfee",
  },
  legal: {
    privacyPolicy: "Privacy Policy",
    termsOfUse: "Terms of Use",
  },
}
