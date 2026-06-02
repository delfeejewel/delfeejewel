"use client"

import { Popover, PopoverPanel, Transition } from "@headlessui/react"
import { ArrowRightMini, XMark } from "@medusajs/icons"
import { Text, clx, useToggleState } from "@medusajs/ui"
import { Fragment } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CountrySelect from "../country-select"
import LanguageSelect from "../language-select"
import { HttpTypes } from "@medusajs/types"
import { Locale } from "@lib/data/locales"
import { BRAND } from "@lib/constants.brand"

type SideMenuProps = {
  regions: HttpTypes.StoreRegion[] | null
  locales: Locale[] | null
  currentLocale: string | null
  categories?: { name: string; handle: string }[]
}

const SideMenu = ({ regions, locales, currentLocale, categories }: SideMenuProps) => {
  const countryToggleState = useToggleState()
  const languageToggleState = useToggleState()

  return (
    <div className="h-full">
      <div className="flex items-center h-full">
        <Popover className="h-full flex">
          {({ open, close }) => (
            <>
              <div className="relative flex h-full">
                <Popover.Button
                  data-testid="nav-menu-button"
                  className="relative h-full flex items-center justify-center w-9 h-9 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors duration-200 focus:outline-none"
                >
                  {/* Hamburger icon */}
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--color-text-secondary)" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </Popover.Button>
              </div>

              {open && (
                <div
                  className="fixed inset-0 z-[50] bg-black/30 backdrop-blur-sm pointer-events-auto"
                  onClick={close}
                  data-testid="side-menu-backdrop"
                />
              )}

              <Transition
                show={open}
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="-translate-x-full opacity-0"
                enterTo="translate-x-0 opacity-100"
                leave="transition ease-in duration-150"
                leaveFrom="translate-x-0 opacity-100"
                leaveTo="-translate-x-full opacity-0"
              >
                <PopoverPanel className="fixed left-0 top-0 w-[85%] xsmall:w-[320px] h-full z-[51] font-outfit">
                  <div
                    data-testid="nav-menu-popup"
                    className="flex flex-col h-full bg-white justify-between"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-lavender)]">
                      <span className="font-wittgenstein text-lg font-bold tracking-[0.06em] uppercase text-[var(--color-text-primary)]">
                        {BRAND.name}
                      </span>
                      <button
                        data-testid="close-menu-button"
                        onClick={close}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--color-bg-secondary)] transition-colors duration-200"
                      >
                        <XMark />
                      </button>
                    </div>

                    {/* Navigation links */}
                    <ul className="flex-1 flex flex-col gap-1 px-4 py-4 overflow-y-auto">
                      <li>
                        <LocalizedClientLink
                          href="/"
                          className="flex items-center px-3 py-3 rounded-lg text-[15px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors duration-200"
                          onClick={close}
                          data-testid="home-link"
                        >
                          Home
                        </LocalizedClientLink>
                      </li>

                      {/* Categories section */}
                      {categories && categories.length > 0 && (
                        <>
                          <li className="px-3 pt-4 pb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-gold)]">
                              Categories
                            </span>
                          </li>
                          {categories.map((cat) => (
                            <li key={cat.handle}>
                              <LocalizedClientLink
                                href={`/categories/${cat.handle}`}
                                className="flex items-center px-3 py-2.5 rounded-lg text-[14px] text-[var(--color-text-secondary)] hover:text-[var(--color-plum)] hover:bg-[var(--color-bg-secondary)] transition-colors duration-200"
                                onClick={close}
                                data-testid={`${cat.handle}-link`}
                              >
                                {cat.name}
                              </LocalizedClientLink>
                            </li>
                          ))}
                        </>
                      )}

                      {/* Divider */}
                      <li className="my-2 mx-3 h-px bg-[var(--color-lavender)]" />

                      <li>
                        <LocalizedClientLink
                          href="/store"
                          className="flex items-center px-3 py-3 rounded-lg text-[15px] font-semibold text-[var(--color-plum)] hover:bg-[var(--color-bg-secondary)] transition-colors duration-200"
                          onClick={close}
                          data-testid="all-jewellery-link"
                        >
                          All Collections
                        </LocalizedClientLink>
                      </li>
                      <li>
                        <LocalizedClientLink
                          href="/account"
                          className="flex items-center px-3 py-3 rounded-lg text-[15px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors duration-200"
                          onClick={close}
                          data-testid="account-link"
                        >
                          Account
                        </LocalizedClientLink>
                      </li>
                      <li>
                        <LocalizedClientLink
                          href="/account/wishlist"
                          className="flex items-center px-3 py-3 rounded-lg text-[15px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors duration-200"
                          onClick={close}
                        >
                          Wishlist
                        </LocalizedClientLink>
                      </li>
                      <li>
                        <LocalizedClientLink
                          href="/cart"
                          className="flex items-center px-3 py-3 rounded-lg text-[15px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors duration-200"
                          onClick={close}
                          data-testid="cart-link"
                        >
                          Cart
                        </LocalizedClientLink>
                      </li>
                    </ul>

                    {/* Bottom section */}
                    <div className="px-6 py-5 border-t border-[var(--color-lavender)] space-y-4">
                      {!!locales?.length && (
                        <div
                          className="flex justify-between items-center"
                          onMouseEnter={languageToggleState.open}
                          onMouseLeave={languageToggleState.close}
                        >
                          <LanguageSelect
                            toggleState={languageToggleState}
                            locales={locales}
                            currentLocale={currentLocale}
                          />
                          <ArrowRightMini
                            className={clx(
                              "transition-transform duration-150 text-[var(--color-text-muted)]",
                              languageToggleState.state ? "-rotate-90" : ""
                            )}
                          />
                        </div>
                      )}
                      <div
                        className="flex justify-between items-center"
                        onMouseEnter={countryToggleState.open}
                        onMouseLeave={countryToggleState.close}
                      >
                        {regions && (
                          <CountrySelect
                            toggleState={countryToggleState}
                            regions={regions}
                          />
                        )}
                        <ArrowRightMini
                          className={clx(
                            "transition-transform duration-150 text-[var(--color-text-muted)]",
                            countryToggleState.state ? "-rotate-90" : ""
                          )}
                        />
                      </div>
                      <Text
                        className="text-[11px] text-[var(--color-text-muted)]"
                        suppressHydrationWarning
                      >
                        {BRAND.copyright(new Date().getFullYear())}
                      </Text>
                    </div>
                  </div>
                </PopoverPanel>
              </Transition>
            </>
          )}
        </Popover>
      </div>
    </div>
  )
}

export default SideMenu
