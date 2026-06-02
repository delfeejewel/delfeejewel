import { Suspense } from "react"

import { listRegions } from "@lib/data/regions"
import { listLocales } from "@lib/data/locales"
import { listCategories } from "@lib/data/categories"
import { getLocale } from "@lib/data/locale-actions"
import { getStoreInfo, getHeaderSettings, getMenu } from "@lib/data/cms"
import { BRAND } from "@lib/constants.brand"
import { StoreRegion } from "@medusajs/types"
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import SideMenu from "@modules/layout/components/side-menu"
import SearchAutocomplete from "@modules/search/components/search-autocomplete"
import MobileSearch from "@modules/search/components/mobile-search"

export default async function Nav() {
  const [regions, locales, currentLocale, categories, storeInfo, headerSettings, quickLinksMenu] =
    await Promise.all([
      listRegions().then((regions: StoreRegion[]) => regions),
      listLocales(),
      getLocale(),
      listCategories({ limit: 20 }),
      getStoreInfo(),
      getHeaderSettings(),
      getMenu("header_quick_links"),
    ])

  const topLevelCategories = categories?.filter((c) => !c.parent_category) || []

  const email = storeInfo?.email || "support@delfee.com"
  const phone = storeInfo?.phone || "+91 98765 43210"

  const showContact = headerSettings?.show_topbar_contact ?? true
  const showEmail = headerSettings?.show_topbar_email ?? true
  const showPhone = headerSettings?.show_topbar_phone ?? true
  const announcementEnabled = headerSettings?.announcement_enabled ?? true
  const announcementText: string | undefined = headerSettings?.announcement_text || undefined
  const quickLinks =
    quickLinksMenu?.items?.length
      ? quickLinksMenu.items
      : [
          { label: "About", href: "/about" },
          { label: "Contact", href: "/contact" },
        ]

  return (
    <div className="sticky top-0 inset-x-0 z-50 font-outfit">
      {/* Top announcement bar — hidden entirely when disabled in CMS */}
      {announcementEnabled && (
      <div className="w-full [background:linear-gradient(90deg,var(--color-lavender),var(--color-lavender-soft),var(--color-lavender))]">
        <div className="content-container relative flex items-center justify-between h-8 small:h-9 text-[var(--color-plum)]">
          {/* Left: contact */}
          <div className="hidden small:flex items-center gap-4">
            {showContact && (
              <>
                {showEmail && (
                  <a href={`mailto:${email}`} className="flex items-center gap-1.5 text-[11px] opacity-70 hover:opacity-100 transition-opacity duration-200">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    {email}
                  </a>
                )}
                {showEmail && showPhone && <span className="opacity-30">|</span>}
                {showPhone && (
                  <a href={`tel:${phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 text-[11px] opacity-70 hover:opacity-100 transition-opacity duration-200">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                    {phone}
                  </a>
                )}
              </>
            )}
          </div>

          {/* Center: announcement — absolutely positioned for true center */}
          <p className="small:absolute small:left-1/2 small:-translate-x-1/2 text-[10px] small:text-[11px] font-medium tracking-wide text-center w-full small:w-auto small:whitespace-nowrap">
            {announcementText ? (
              announcementText
            ) : (
              <>
                Free Shipping above <span className="font-bold">&#8377;999</span> <span className="hidden 2xsmall:inline">&bull; 925 Sterling Silver &bull; BIS Hallmarked</span>
              </>
            )}
          </p>

          {/* Right: quick links */}
          <div className="hidden small:flex items-center gap-3">
            {quickLinks.map((link, i) => (
              <span key={`${link.href}-${i}`} className="flex items-center gap-3">
                {i > 0 && <span className="opacity-30">|</span>}
                <LocalizedClientLink href={link.href} className="text-[11px] opacity-70 hover:opacity-100 transition-opacity duration-200">
                  {link.label}
                </LocalizedClientLink>
              </span>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Main header bar */}
      <header className="relative mx-auto bg-white backdrop-blur-xl border-b border-[var(--color-lavender)]">
        <nav className="content-container flex items-center justify-between h-14 small:h-16 text-sm">
          {/* Left: Mobile Menu + Logo */}
          <div className="flex items-center gap-x-3">
            <div className="small:hidden">
              <SideMenu
                regions={regions}
                locales={locales}
                currentLocale={currentLocale}
                categories={topLevelCategories.map((c) => ({ name: c.name, handle: c.handle }))}
              />
            </div>
            <LocalizedClientLink
              href="/"
              className="block shrink-0"
              data-testid="nav-store-link"
            >
              <Image
                src="/images/logo-dark.png"
                alt={BRAND.name}
                width={120}
                height={40}
                className="h-8 small:h-10 w-auto object-contain"
                priority
              />
            </LocalizedClientLink>
          </div>

          {/* Center: Search bar (desktop) */}
          <div className="hidden small:flex flex-1 max-w-xl mx-6">
            <SearchAutocomplete variant="desktop" />
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-x-2 small:gap-x-1">
            {/* Mobile search */}
            <MobileSearch />

            {/* Account */}
            <LocalizedClientLink
              href="/account"
              className="hidden small:flex w-9 h-9 rounded-full items-center justify-center hover:bg-[var(--color-bg-secondary)] transition-colors duration-200"
              data-testid="nav-account-link"
              title="Account"
            >
              <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="var(--color-text-secondary)" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </LocalizedClientLink>

            {/* Wishlist */}
            <LocalizedClientLink
              href="/account/wishlist"
              className="hidden small:flex w-9 h-9 rounded-full items-center justify-center hover:bg-[var(--color-bg-secondary)] transition-colors duration-200"
              title="Wishlist"
            >
              <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="var(--color-text-secondary)" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </LocalizedClientLink>

            {/* Cart */}
            <Suspense
              fallback={
                <LocalizedClientLink
                  className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors duration-200"
                  href="/cart"
                  data-testid="nav-cart-link"
                  title="Cart"
                >
                  <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="var(--color-text-secondary)" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </LocalizedClientLink>
              }
            >
              <CartButton />
            </Suspense>
          </div>
        </nav>
      </header>

      {/* Category bar (desktop only) */}
      {topLevelCategories.length > 0 && (
        <div className="hidden small:block w-full bg-[var(--color-bg-primary)] border-b border-[var(--color-lavender)]">
          <div className="content-container">
            <ul className="flex items-center justify-center gap-x-8 h-10 overflow-x-auto no-scrollbar">
              {topLevelCategories.map((category) => (
                <li key={category.id}>
                  <LocalizedClientLink
                    href={`/categories/${category.handle}`}
                    className="text-[12px] font-medium tracking-wide whitespace-nowrap text-[var(--color-text-secondary)] hover:text-[var(--color-plum)] transition-colors duration-300"
                  >
                    {category.name}
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
