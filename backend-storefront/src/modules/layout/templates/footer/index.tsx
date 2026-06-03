import { listCategories } from "@lib/data/categories"
import { getStoreInfo, getFooterSettings, getMenus } from "@lib/data/cms"
import { BRAND } from "@lib/constants.brand"
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ─── Static Data ─────────────────────────────────────── */

const footerLinks = {
  "Know Your Jewellery": [
    { name: "Jewellery Care", href: "/jewellery-care" },
    { name: "Ring Size Guide", href: "/size-guide" },
    { name: "Authenticity & Hallmarking", href: "/authenticity" },
    { name: "FAQs", href: "/faq" },
  ],
  "Customer Service": [
    { name: "Track Your Order", href: "/track-order" },
    { name: "Returns & Exchange", href: "/returns-and-exchange" },
    { name: "Shipping Policy", href: "/shipping-policy" },
    { name: "Contact Us", href: "/contact" },
  ],
  "About Us": [
    { name: "Our Story", href: "/about" },
    { name: "Privacy Policy", href: "/privacy-policy" },
    { name: "Terms & Conditions", href: "/terms-and-conditions" },
  ],
}

/* Social icons keyed by store_info field — href comes from the CMS at runtime */
const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  Instagram: (
    <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  ),
  Facebook: (
    <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  Pinterest: (
    <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.042-3.441.219-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24 18.635 24 24.001 18.633 24.001 12.013 24.001 5.393 18.635.026 12.017.026V0z" />
    </svg>
  ),
  YouTube: (
    <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
}

/* ─── Decorative SVG Icons (blended into background) ──── */

function FloatingIcons() {
  const gold = "var(--color-gold)"
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none hidden xsmall:block" aria-hidden="true">
      {/* Diamond — top left */}
      <svg
        className="deco-anim absolute top-10 left-[6%] w-20 h-20 opacity-[0.08]"
        style={{ animation: "deco-drift 27s ease-in-out infinite" }}
        viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={0.6}
      >
        <path d="M2.5 9h19l-9.5 13L2.5 9zM2.5 9l4-5h11l4 5M7.5 4l4.5 5 4.5-5M12 9v13" />
      </svg>

      {/* Ring — top right */}
      <svg
        className="deco-anim absolute top-16 right-[10%] w-24 h-24 opacity-[0.07]"
        style={{ animation: "deco-drift-alt 32s ease-in-out -7s infinite" }}
        viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={0.5}
      >
        <circle cx="12" cy="14" r="8" />
        <ellipse cx="12" cy="14" rx="4" ry="8" />
        <path d="M8 6.5c1-1.5 2.5-2.5 4-2.5s3 1 4 2.5" />
      </svg>

      {/* Crown — bottom left */}
      <svg
        className="deco-anim absolute bottom-28 left-[12%] w-20 h-20 opacity-[0.08]"
        style={{ animation: "deco-drift-alt 30s ease-in-out -4s infinite" }}
        viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={0.6}
      >
        <path d="M2 20h20M4 20l1-12 4 5 3-9 3 9 4-5 1 12" />
      </svg>

      {/* Gem — bottom right */}
      <svg
        className="deco-anim absolute bottom-16 right-[15%] w-16 h-16 opacity-[0.09]"
        style={{ animation: "deco-drift 25s ease-in-out -11s infinite" }}
        viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={0.6}
      >
        <polygon points="12,2 22,8.5 17,22 7,22 2,8.5" />
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="2" y1="8.5" x2="22" y2="8.5" />
      </svg>

      {/* Sparkle star — mid left */}
      <svg
        className="deco-anim absolute top-[45%] left-[3%] w-14 h-14 opacity-[0.1]"
        style={{ animation: "deco-drift 22s ease-in-out -3s infinite" }}
        viewBox="0 0 24 24" fill={gold}
      >
        <path d="M12 0l2.5 9.5L24 12l-9.5 2.5L12 24l-2.5-9.5L0 12l9.5-2.5z" />
      </svg>

      {/* Pearl cluster — mid right */}
      <svg
        className="deco-anim absolute top-[30%] right-[4%] w-16 h-16 opacity-[0.06]"
        style={{ animation: "deco-drift 29s ease-in-out -9s infinite" }}
        viewBox="0 0 24 24" fill={gold}
      >
        <circle cx="12" cy="12" r="5" />
        <circle cx="6" cy="8" r="2.5" />
        <circle cx="18" cy="8" r="2.5" />
        <circle cx="8" cy="18" r="2" />
        <circle cx="16" cy="18" r="2" />
      </svg>

      {/* Small sparkles — twinkle */}
      <svg
        className="deco-anim absolute top-[60%] right-[30%] w-8 h-8"
        style={{ animation: "deco-twinkle 7s ease-in-out infinite" }}
        viewBox="0 0 24 24" fill={gold}
      >
        <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
      </svg>
      <svg
        className="deco-anim absolute top-[20%] left-[30%] w-6 h-6"
        style={{ animation: "deco-twinkle 6s ease-in-out -3s infinite" }}
        viewBox="0 0 24 24" fill={gold}
      >
        <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
      </svg>
      <svg
        className="deco-anim absolute bottom-[35%] left-[55%] w-10 h-10"
        style={{ animation: "deco-twinkle 8s ease-in-out -1.5s infinite" }}
        viewBox="0 0 24 24" fill={gold}
      >
        <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
      </svg>

      {/* Gradient glows */}
      <div
        className="deco-anim absolute -top-20 -left-20 w-96 h-96 rounded-full bg-[var(--color-gold)]/[0.06] blur-3xl"
        style={{ animation: "deco-glow 24s ease-in-out infinite" }}
      />
      <div
        className="deco-anim absolute -bottom-20 -right-20 w-[28rem] h-[28rem] rounded-full bg-white/[0.03] blur-3xl"
        style={{ animation: "deco-glow 30s ease-in-out -8s infinite reverse" }}
      />
      <div
        className="deco-anim absolute top-[calc(50%-300px)] left-[calc(50%-300px)] w-[600px] h-[600px] rounded-full bg-[var(--color-gold)]/[0.03] blur-[120px]"
        style={{ animation: "deco-glow 34s ease-in-out -14s infinite" }}
      />
    </div>
  )
}

/* ─── Contact Icon Button ─────────────────────────────── */

function ContactBtn({ href, title, children }: { href: string; title: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/50 hover:text-[var(--color-gold)] transition-all duration-300"
      title={title}
    >
      {children}
    </a>
  )
}

/* ─── Footer Component ────────────────────────────────── */

export default async function Footer() {
  const [productCategories, storeInfo, footerSettings, footerMenus] =
    await Promise.all([
      listCategories(),
      getStoreInfo(),
      getFooterSettings(),
      getMenus(["footer_col_1", "footer_col_2", "footer_col_3"]),
    ])
  const topLevelCategories = productCategories?.filter((c) => !c.parent_category) || []

  const newsletterHeading = footerSettings?.newsletter_heading || "Stay in the loop"
  const tagline = footerSettings?.tagline || BRAND.tagline

  // Footer link columns: prefer CMS menus, fall back to the curated defaults.
  const cmsColumns = ["footer_col_1", "footer_col_2", "footer_col_3"]
    .map((loc) => footerMenus[loc])
    .filter((m): m is { name: string; items: { label: string; href: string }[] } => !!m && m.items.length > 0)
    .map((m) => ({
      title: m.name,
      links: m.items.map((i) => ({ name: i.label, href: i.href })),
    }))
  const linkColumns =
    cmsColumns.length > 0
      ? cmsColumns
      : Object.entries(footerLinks).map(([title, links]) => ({ title, links }))

  const email = storeInfo?.email || "enquire@delfee.in"
  const phone = storeInfo?.phone || ""
  const whatsapp = storeInfo?.whatsapp || ""
  const telHref = phone ? `tel:${phone.replace(/\s/g, "")}` : undefined
  const whatsappHref = whatsapp
    ? `https://wa.me/${whatsapp.replace(/[^\d]/g, "")}`
    : undefined

  // Social icons are data-driven: render only the ones with a URL set in CMS.
  const socials = [
    { name: "Instagram", href: storeInfo?.instagram },
    { name: "Facebook", href: storeInfo?.facebook },
    { name: "Pinterest", href: storeInfo?.pinterest },
    { name: "YouTube", href: storeInfo?.youtube },
  ].filter((s): s is { name: string; href: string } => !!s.href)

  return (
    <footer className="w-full relative overflow-hidden font-outfit [background:var(--gradient-footer)] pb-[76px] small:pb-0">
      <FloatingIcons />

      {/* Top accent line */}
      <div className="h-[2px] w-full [background:linear-gradient(90deg,transparent,var(--color-gold),transparent)]" />

      <div className="content-container relative z-10">

        {/* ─── Brand Row ──────────────────────────── */}
        <div className="pt-14 pb-10 small:pt-16 small:pb-12 flex flex-col small:flex-row items-start small:items-end justify-between gap-6 border-b border-white/[0.07]">
          <div>
            <Image
              src="/images/logo-light.png"
              alt={BRAND.name}
              width={140}
              height={48}
              className="h-10 small:h-12 w-auto object-contain"
            />
            <p className="text-[13px] small:text-[14px] text-white/50 mt-3 max-w-sm leading-relaxed">
              {tagline}. Timeless pieces crafted with love, designed to be treasured forever.
            </p>
          </div>

          {/* Newsletter mini */}
          <div className="w-full small:w-auto small:min-w-[320px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-gold)] mb-3">
              {newsletterHeading}
            </p>
            <div className="flex">
              <input
                type="email"
                placeholder="Your email address"
                className="flex-1 h-11 px-4 rounded-l-lg bg-white/[0.07] border border-white/[0.1] border-r-0 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--color-gold)]/40 transition-colors"
              />
              <button className="h-11 px-6 rounded-r-lg text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-footer-bg-deep)] [background:var(--gradient-gold-btn)] transition-all duration-300 hover:brightness-110 shrink-0">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* ─── Main Links Grid ────────────────────── */}
        <div className="grid grid-cols-2 xsmall:grid-cols-3 small:grid-cols-5 gap-8 small:gap-6 py-10 small:py-14">
          {/* Dynamic categories column */}
          {topLevelCategories.length > 0 && (
            <div className="flex flex-col gap-y-3">
              <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[var(--color-gold)] mb-1">
                Shop by Category
              </span>
              <ul className="space-y-2.5">
                {topLevelCategories.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <LocalizedClientLink
                      className="text-[13px] text-white/50 hover:text-white transition-colors duration-300"
                      href={`/categories/${c.handle}`}
                    >
                      {c.name}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Link columns — CMS menus with hardcoded fallback */}
          {linkColumns.map((column) => (
            <div key={column.title} className="flex flex-col gap-y-3">
              <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[var(--color-gold)] mb-1">
                {column.title}
              </span>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.name}`}>
                    <LocalizedClientLink
                      className="text-[13px] text-white/50 hover:text-white transition-colors duration-300"
                      href={link.href}
                    >
                      {link.name}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact Us column */}
          <div className="flex flex-col gap-y-3 col-span-2 xsmall:col-span-3 small:col-span-1">
            <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[var(--color-gold)] mb-1">
              Contact Us
            </span>
            <div className="text-[13px] text-white/50 leading-relaxed space-y-1">
              <p className="text-white/80 font-medium">{BRAND.name}</p>
              <p>24x7 Enquiry Support</p>
              <a
                href={`mailto:${email}`}
                className="text-[var(--color-gold)]/80 hover:text-[var(--color-gold)] transition-colors duration-300 block"
              >
                {email}
              </a>
              {phone && <p className="text-white/50">{phone}</p>}
            </div>

            {/* Contact icons row */}
            <div className="flex items-center gap-3 mt-2">
              {telHref && (
                <ContactBtn href={telHref} title="Call Us">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </ContactBtn>
              )}
              {whatsappHref && (
                <ContactBtn href={whatsappHref} title="WhatsApp">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </ContactBtn>
              )}
              <ContactBtn href={`mailto:${email}`} title="Email">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </ContactBtn>
            </div>
          </div>
        </div>

        {/* ─── Divider ────────────────────────────── */}
        <div className="h-px w-full bg-white/[0.07]" />

        {/* ─── Bottom Bar ─────────────────────────── */}
        <div className="py-8 small:py-10 flex flex-col small:flex-row items-start small:items-center justify-between gap-6">
          {/* Social links — only those with a URL configured in CMS */}
          {socials.length > 0 && (
            <div className="flex items-center gap-5">
              {socials.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/30 hover:text-[var(--color-gold)] transition-all duration-300 hover:scale-110"
                  title={social.name}
                >
                  {SOCIAL_ICONS[social.name]}
                </a>
              ))}
            </div>
          )}

          {/* Payment methods */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Visa */}
            <div className="h-8 w-12 rounded bg-white/[0.07] border border-white/[0.1] flex items-center justify-center p-1.5">
              <svg viewBox="0 0 780 500" className="w-full h-full">
                <path d="M293.2 348.7l33.4-195.8h53.4l-33.4 195.8h-53.4zM538.7 158.6c-10.6-4-27.2-8.3-47.9-8.3-52.8 0-90 26.6-90.3 64.7-.3 28.2 26.6 43.9 46.9 53.3 20.9 9.6 27.9 15.7 27.8 24.3-.1 13.1-16.7 19.1-32.1 19.1-21.4 0-32.8-3-50.4-10.2l-6.9-3.1-7.5 44c12.5 5.5 35.6 10.2 59.6 10.5 56.1 0 92.5-26.3 92.9-67 .2-22.3-14-39.3-44.8-53.3-18.6-9.1-30.1-15.1-30-24.3 0-8.1 9.7-16.8 30.6-16.8 17.4-.3 30.1 3.5 39.9 7.5l4.8 2.3 7.4-42.7zM676.3 152.9h-41.3c-12.8 0-22.4 3.5-28 16.3l-79.3 179.5h56.1s9.2-24.1 11.2-29.4c6.1 0 60.6.1 68.4.1 1.6 6.9 6.5 29.3 6.5 29.3h49.6l-43.2-195.8zm-65.8 126.4c4.4-11.3 21.3-54.7 21.3-54.7-.3.5 4.4-11.3 7.1-18.7l3.6 16.9s10.2 46.8 12.4 56.6h-44.4zM232.1 152.9L179.6 290l-5.6-27.1c-9.7-31.2-39.9-65.1-73.7-82l47.8 167.7h56.5l84-195.8h-56.5z" fill="#1a1f71"/>
                <path d="M124.7 152.9H38.2l-.7 3.8c67 16.2 111.4 55.4 129.8 102.4l-18.7-90c-3.2-12.4-12.6-15.8-23.9-16.2z" fill="#f9a533"/>
              </svg>
            </div>
            {/* Mastercard */}
            <div className="h-8 w-12 rounded bg-white/[0.07] border border-white/[0.1] flex items-center justify-center p-1.5">
              <svg viewBox="0 0 780 500" className="w-full h-full">
                <circle cx="312" cy="250" r="195" fill="#eb001b"/>
                <circle cx="468" cy="250" r="195" fill="#f79e1b"/>
                <path d="M390 100.2c-48.4 38.1-79.4 97.2-79.4 163.8s31 125.7 79.4 163.8c48.4-38.1 79.4-97.2 79.4-163.8S438.4 138.3 390 100.2z" fill="#ff5f00"/>
              </svg>
            </div>
            {/* RuPay */}
            <div className="h-8 w-12 rounded bg-white/[0.07] border border-white/[0.1] flex items-center justify-center px-1">
              <svg viewBox="0 0 200 60" className="w-full h-full">
                <text x="100" y="38" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="26" fontWeight="bold">
                  <tspan fill="#0072bc">Ru</tspan><tspan fill="#f7941d">Pay</tspan>
                </text>
              </svg>
            </div>
            {/* UPI */}
            <div className="h-8 w-12 rounded bg-white/[0.07] border border-white/[0.1] flex items-center justify-center px-1">
              <svg viewBox="0 0 200 80" className="w-full h-full">
                <text x="100" y="50" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="36" fontWeight="bold" fill="#6c7e34">UPI</text>
              </svg>
            </div>
            {/* PayPal */}
            <div className="h-8 w-12 rounded bg-white/[0.07] border border-white/[0.1] flex items-center justify-center p-1.5">
              <svg viewBox="0 0 780 500" className="w-full h-full">
                <path d="M622.8 201.6c-8.1 53.4-48.7 53.4-88 53.4h-22.3l15.7-99.2h22.3c39.4 0 80.4 0 72.3 45.8zm-17.2-103.5H437.4L370.6 450h85.5l19-120h62.8c82.6 0 117-40 126.6-100 10.8-67.3-20.3-132-58.9-131.9z" fill="#003087"/>
                <path d="M520 201.6c-8.1 53.4-48.7 53.4-88 53.4h-22.3l15.7-99.2h22.3c39.4 0 80.4 0 72.3 45.8zm-17.2-103.5H334.6L267.8 450h85.5l19-120h62.8c82.6 0 117-40 126.6-100 10.8-67.3-20.3-132-58.9-131.9z" fill="#0070e0"/>
              </svg>
            </div>
            {/* Razorpay */}
            <div className="h-8 w-12 rounded bg-white/[0.07] border border-white/[0.1] flex items-center justify-center p-1">
              <svg viewBox="0 0 200 60" className="w-full h-full">
                <polygon points="30,5 45,55 15,55" fill="#3395ff"/>
                <text x="115" y="42" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="20" fontWeight="bold" fill="#3395ff">Razorpay</text>
              </svg>
            </div>
          </div>
        </div>

        {/* ─── Copyright ──────────────────────────── */}
        <div className="pb-8 small:pb-10 flex flex-col small:flex-row items-start small:items-center justify-between gap-4 border-t border-white/[0.05] pt-6">
          <p
            className="text-[11px] text-white/25 tracking-wide"
            suppressHydrationWarning
          >
            {BRAND.copyright(new Date().getFullYear())}
          </p>
          <div className="flex items-center gap-4">
            <LocalizedClientLink href="/privacy-policy" className="text-[11px] text-white/25 hover:text-white/50 transition-colors duration-300">
              Privacy Policy
            </LocalizedClientLink>
            <span className="text-white/10">|</span>
            <LocalizedClientLink href="/terms-and-conditions" className="text-[11px] text-white/25 hover:text-white/50 transition-colors duration-300">
              Terms & Conditions
            </LocalizedClientLink>
          </div>
        </div>
      </div>
    </footer>
  )
}
