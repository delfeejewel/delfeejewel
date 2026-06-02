import LocalizedClientLink from "@modules/common/components/localized-client-link"

export type Crumb = { label: string; href?: string }

type PageHeroProps = {
  eyebrow?: string
  title: string
  description?: string
  breadcrumb?: Crumb[]
  align?: "center" | "left"
}

/**
 * Standardized hero band for content pages — gold eyebrow, serif title,
 * optional breadcrumb. Keeps every content page visually consistent.
 */
export default function PageHero({
  eyebrow,
  title,
  description,
  breadcrumb,
  align = "center",
}: PageHeroProps) {
  const isCenter = align === "center"

  return (
    <section className="relative overflow-hidden border-b border-[var(--color-border)] [background:linear-gradient(135deg,#faf9f7_0%,#f4f3f1_45%,#e6e2ee_100%)]">
      <div className="absolute -top-24 -right-16 w-96 h-96 rounded-full bg-[var(--color-gold)]/[0.07] blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -left-20 w-96 h-96 rounded-full bg-[var(--color-plum)]/[0.06] blur-3xl pointer-events-none" />

      <div className="page-container relative z-10 py-14 small:py-20">
        <div
          className={`flex flex-col gap-4 max-w-3xl ${
            isCenter ? "items-center text-center mx-auto" : "items-start text-left"
          }`}
        >
          {breadcrumb && breadcrumb.length > 0 && (
            <nav
              aria-label="Breadcrumb"
              className="flex items-center flex-wrap gap-2 text-[12px] text-[var(--color-text-muted)]"
            >
              {breadcrumb.map((c, i) => (
                <span key={`${c.label}-${i}`} className="flex items-center gap-2">
                  {i > 0 && <span className="text-[var(--color-border)]">/</span>}
                  {c.href ? (
                    <LocalizedClientLink
                      href={c.href}
                      className="hover:text-[var(--color-plum)] transition-colors"
                    >
                      {c.label}
                    </LocalizedClientLink>
                  ) : (
                    <span className="text-[var(--color-text-secondary)]">
                      {c.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          )}

          {eyebrow && (
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]">
              {eyebrow}
            </span>
          )}

          <h1 className="font-wittgenstein text-[32px] small:text-[44px] font-bold leading-tight text-[var(--color-plum)]">
            {title}
          </h1>

          {description && (
            <p className="text-[15px] small:text-[16px] leading-relaxed text-[var(--color-text-secondary)]">
              {description}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
