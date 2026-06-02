"use client"

import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import DeleteButton from "@modules/common/components/delete-button"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import { usePathname } from "next/navigation"
import { Fragment, useEffect, useRef, useState } from "react"

const CartDropdown = ({
  cart: cartState,
}: {
  cart?: HttpTypes.StoreCart | null
}) => {
  const [activeTimer, setActiveTimer] = useState<NodeJS.Timer | undefined>(
    undefined
  )
  const [cartDropdownOpen, setCartDropdownOpen] = useState(false)

  const open = () => setCartDropdownOpen(true)
  const close = () => setCartDropdownOpen(false)

  const totalItems =
    cartState?.items?.reduce((acc, item) => {
      return acc + item.quantity
    }, 0) || 0

  const subtotal = cartState?.subtotal ?? 0
  const itemRef = useRef<number>(totalItems || 0)

  const timedOpen = () => {
    open()
    const timer = setTimeout(close, 5000)
    setActiveTimer(timer)
  }

  const openAndCancel = () => {
    if (activeTimer) {
      clearTimeout(activeTimer)
    }
    open()
  }

  useEffect(() => {
    return () => {
      if (activeTimer) {
        clearTimeout(activeTimer)
      }
    }
  }, [activeTimer])

  const pathname = usePathname()

  useEffect(() => {
    if (itemRef.current !== totalItems && !pathname.includes("/cart")) {
      timedOpen()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalItems, itemRef.current])

  return (
    <div
      className="h-full z-50"
      onMouseEnter={openAndCancel}
      onMouseLeave={close}
    >
      <Popover className="relative h-full">
        <PopoverButton className="h-full flex items-center justify-center">
          <LocalizedClientLink
            className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors duration-200"
            href="/cart"
            data-testid="nav-cart-link"
          >
            <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="var(--color-text-secondary)" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            {totalItems > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-[var(--color-plum)] text-white text-[10px] font-bold flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </LocalizedClientLink>
        </PopoverButton>
        <Transition
          show={cartDropdownOpen}
          as={Fragment}
          enter="transition ease-out duration-200"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-150"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-1"
        >
          <PopoverPanel
            static
            className="hidden small:block absolute top-[calc(100%+1px)] right-0 w-[400px] rounded-xl border border-[var(--color-lavender)] bg-white shadow-xl font-outfit"
            data-testid="nav-cart-dropdown"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--color-lavender)]">
              <h3 className="font-wittgenstein text-[16px] font-semibold text-[var(--color-text-primary)]">
                Shopping Bag
                {totalItems > 0 && (
                  <span className="ml-2 text-[12px] font-normal text-[var(--color-text-muted)]">
                    ({totalItems} {totalItems === 1 ? "item" : "items"})
                  </span>
                )}
              </h3>
            </div>

            {cartState && cartState.items?.length ? (
              <>
                <div className="overflow-y-auto max-h-[360px] px-5 py-3 space-y-4 no-scrollbar">
                  {cartState.items
                    .sort((a, b) => {
                      return (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
                    })
                    .map((item) => (
                      <div
                        className="flex gap-3 py-2"
                        key={item.id}
                        data-testid="cart-item"
                      >
                        <LocalizedClientLink
                          href={`/products/${item.product_handle}`}
                          className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-[var(--color-lavender)]"
                        >
                          <Thumbnail
                            thumbnail={item.thumbnail}
                            images={item.variant?.product?.images}
                            size="square"
                          />
                        </LocalizedClientLink>
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">
                                <LocalizedClientLink
                                  href={`/products/${item.product_handle}`}
                                  data-testid="product-link"
                                >
                                  {item.title}
                                </LocalizedClientLink>
                              </h4>
                              <LineItemOptions
                                variant={item.variant}
                                data-testid="cart-item-variant"
                                data-value={item.variant}
                              />
                              <span
                                className="text-[11px] text-[var(--color-text-muted)]"
                                data-testid="cart-item-quantity"
                                data-value={item.quantity}
                              >
                                Qty: {item.quantity}
                              </span>
                            </div>
                            <div className="shrink-0 text-right">
                              <LineItemPrice
                                item={item}
                                style="tight"
                                currencyCode={cartState.currency_code}
                              />
                            </div>
                          </div>
                          <DeleteButton
                            id={item.id}
                            className="mt-1 self-start text-[11px] text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
                            data-testid="cart-item-remove-button"
                          >
                            Remove
                          </DeleteButton>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-[var(--color-lavender)] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
                      Subtotal <span className="font-normal text-[var(--color-text-muted)]">(excl. taxes)</span>
                    </span>
                    <span
                      className="text-[15px] font-bold text-[var(--color-plum)]"
                      data-testid="cart-subtotal"
                      data-value={subtotal}
                    >
                      {convertToLocale({
                        amount: subtotal,
                        currency_code: cartState.currency_code,
                      })}
                    </span>
                  </div>
                  <LocalizedClientLink href="/cart" passHref>
                    <button
                      className="w-full h-11 rounded-lg text-[13px] font-semibold uppercase tracking-[0.06em] text-white transition-all duration-300 hover:brightness-110 [background:linear-gradient(135deg,var(--color-plum),var(--color-footer-bg))]"
                      data-testid="go-to-cart-button"
                    >
                      View Cart & Checkout
                    </button>
                  </LocalizedClientLink>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-5">
                <div className="w-12 h-12 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </div>
                <p className="text-[14px] font-medium text-[var(--color-text-primary)] mb-1">Your bag is empty</p>
                <p className="text-[12px] text-[var(--color-text-muted)] mb-5">Discover our handcrafted jewellery</p>
                <LocalizedClientLink href="/store">
                  <button
                    onClick={close}
                    className="h-10 px-8 rounded-lg text-[12px] font-semibold uppercase tracking-[0.06em] border border-[var(--color-plum)] text-[var(--color-plum)] hover:bg-[var(--color-plum)] hover:text-white transition-all duration-300"
                  >
                    Explore Collection
                  </button>
                </LocalizedClientLink>
              </div>
            )}
          </PopoverPanel>
        </Transition>
      </Popover>
    </div>
  )
}

export default CartDropdown
