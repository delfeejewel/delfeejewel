/**
 * Brand configuration — change these values to update the brand name
 * across the entire storefront. All components import from here.
 */

export const BRAND = {
  name: "Delfee",
  tagline: "Handcrafted Fine Jewellery",
  description:
    "Discover handcrafted rings, necklaces, earrings and bracelets. Timeless jewellery in gold, silver and precious stones, designed to be treasured forever.",
  copyright: (year: number) => `© ${year} Delfee. All rights reserved.`,
  meta: {
    title: "Delfee — Handcrafted Fine Jewellery",
    productSuffix: "Delfee",
    categorySuffix: "Delfee",
    collectionSuffix: "Delfee",
  },
  legal: {
    privacyPolicy: "Privacy Policy",
    termsOfUse: "Terms of Use",
  },
}
