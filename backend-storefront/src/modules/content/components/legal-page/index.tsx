import React from "react"
import { ArrowRight } from "lucide-react"
import DOMPurify from "isomorphic-dompurify"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import PageHero from "../page-hero"
import LegalBackdrop from "./legal-backdrop"

export type LegalSection = {
  id: string
  heading: string
  body: React.ReactNode
}

type LegalPageProps = {
  title: string
  eyebrow?: string
  intro?: string
  lastUpdated: string
  sections: LegalSection[]
}

/**
 * Shared layout for policy / legal pages — animated decorative backdrop, hero,
 * sticky table of contents and numbered sections. Section bodies are plain JSX
 * (<p>, <ul>, <strong>); the prose wrapper styles them consistently.
 */
export default function LegalPage({
  title,
  eyebrow = "Legal",
  intro,
  lastUpdated,
  sections,
}: LegalPageProps) {
  return (
    <div className="relative bg-[var(--color-bg-primary)] font-outfit min-h-screen">
      <LegalBackdrop />

      <div className="relative z-10">
        <PageHero
          eyebrow={eyebrow}
          title={title}
          description={intro}
          breadcrumb={[{ label: "Home", href: "/" }, { label: title }]}
        />

        <div className="page-container py-12 small:py-16">
          <div className="grid grid-cols-1 medium:grid-cols-[250px_1fr] gap-10 medium:gap-14">
            {/* Table of contents */}
            <aside className="hidden medium:block">
              <div className="sticky top-40 legal-enter">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-4">
                  On this page
                </p>
                <nav className="flex flex-col border-l border-[var(--color-border)]">
                  {sections.map((s) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className="group flex items-center gap-2 pl-4 -ml-px border-l-2 border-transparent hover:border-[var(--color-gold)] text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-plum)] hover:translate-x-1 transition-all duration-300 py-1.5"
                    >
                      <span className="w-1 h-1 rounded-full bg-[var(--color-gold)] scale-0 group-hover:scale-100 transition-transform duration-300" />
                      {s.heading}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Content */}
            <div
              className="max-w-[760px] legal-enter"
              style={{ animationDelay: "0.12s" }}
            >
              <p className="text-[13px] text-[var(--color-text-muted)] mb-8 pb-6 border-b border-[var(--color-border)]">
                Last updated:{" "}
                <span className="font-medium text-[var(--color-text-secondary)]">
                  {lastUpdated}
                </span>
              </p>

              <div className="flex flex-col gap-10">
                {sections.map((s, i) => (
                  <section
                    key={s.id}
                    id={s.id}
                    className="group scroll-mt-40"
                  >
                    <h2 className="font-wittgenstein text-[22px] small:text-[24px] font-bold text-[var(--color-plum)] mb-3 flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-lavender)] text-[var(--color-plum)] text-[14px] font-bold shrink-0 group-hover:bg-[var(--color-gold)] group-hover:text-[var(--color-plum-deep)] group-hover:scale-110 group-hover:rotate-[8deg] transition-all duration-300">
                        {i + 1}
                      </span>
                      <span className="group-hover:text-[var(--color-plum-deep)] transition-colors duration-300">
                        {s.heading}
                      </span>
                    </h2>
                    {typeof s.body === "string" ? (
                      <div
                        className="pl-11 text-[14px] small:text-[15px] leading-[1.8] text-[var(--color-text-secondary)] flex flex-col gap-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_strong]:font-semibold [&_strong]:text-[var(--color-text-primary)] [&_a]:text-[var(--color-plum)] [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(s.body) }}
                      />
                    ) : (
                      <div className="pl-11 text-[14px] small:text-[15px] leading-[1.8] text-[var(--color-text-secondary)] flex flex-col gap-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_strong]:font-semibold [&_strong]:text-[var(--color-text-primary)] [&_a]:text-[var(--color-plum)] [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2">
                        {s.body}
                      </div>
                    )}
                  </section>
                ))}
              </div>

              {/* Help footer */}
              <div className="group mt-14 p-6 small:p-8 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-gold)]/40 hover:shadow-[0_18px_40px_rgba(93,46,70,0.08)] hover:-translate-y-0.5 transition-all duration-300">
                <p className="font-wittgenstein text-[18px] font-semibold text-[var(--color-plum)] mb-1">
                  Still have questions?
                </p>
                <p className="text-[14px] text-[var(--color-text-secondary)] mb-4">
                  Our customer care team is happy to help clarify anything in this
                  policy.
                </p>
                <LocalizedClientLink
                  href="/contact"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] transition-all"
                >
                  Contact Us
                  <ArrowRight
                    size={15}
                    className="group-hover:translate-x-1 transition-transform duration-300"
                  />
                </LocalizedClientLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
