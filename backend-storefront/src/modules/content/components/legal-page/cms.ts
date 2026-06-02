import type { LegalSection } from "."

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Map CMS content_json sections (heading + HTML body) to LegalPage sections,
// falling back to the hardcoded sections when the page has no CMS content yet.
export function cmsSections(cj: any, fallback: LegalSection[]): LegalSection[] {
  if (!cj?.sections?.length) return fallback
  return cj.sections
    .filter((s: any) => s?.heading)
    .map((s: any, i: number) => ({
      id: slugify(s.heading) || `section-${i + 1}`,
      heading: s.heading,
      body: s.body || "",
    }))
}
