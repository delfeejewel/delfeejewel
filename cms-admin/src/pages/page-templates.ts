// Single source of truth for page templates (shared across the page editors).

export const STANDARD_TEMPLATE = "standard"
export const ABOUT_TEMPLATE = "about_us"
export const POLICY_TEMPLATE = "policy"
export const AUTHENTICITY_TEMPLATE = "authenticity"
export const CONTACT_TEMPLATE = "contact"
export const JEWELLERY_CARE_TEMPLATE = "jewellery_care"
export const SIZE_GUIDE_TEMPLATE = "size_guide"
// Pages whose layout still lives in the storefront code. They are listed here so
// their SEO and visibility can be managed; an editable template is added later.
export const CODED_TEMPLATE = "coded"

const ALL_TEMPLATES = [
  { value: ABOUT_TEMPLATE, label: "About Us" },
  { value: AUTHENTICITY_TEMPLATE, label: "Authenticity & Hallmarking" },
  { value: CONTACT_TEMPLATE, label: "Contact Us" },
  { value: JEWELLERY_CARE_TEMPLATE, label: "Jewellery Care Guide" },
  { value: SIZE_GUIDE_TEMPLATE, label: "Ring Size Guide" },
  { value: STANDARD_TEMPLATE, label: "Standard (HTML content)" },
  { value: POLICY_TEMPLATE, label: "Sectioned Page" },
  { value: CODED_TEMPLATE, label: "Coded Layout" },
]

// Templates a user can assign when creating/editing a page. "Coded Layout" is
// seeded from existing hardcoded routes and can't be chosen from the CMS.
export const TEMPLATE_OPTIONS = ALL_TEMPLATES.filter((t) => t.value !== CODED_TEMPLATE)

export const templateLabel = (v: string) =>
  ALL_TEMPLATES.find((t) => t.value === v)?.label || "Standard"
