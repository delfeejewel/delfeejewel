"use client"

import { isCod, isManual, isRazorpay } from "@lib/constants"
import { initiatePaymentSession, placeOrder, retrieveCart } from "@lib/data/cart"
import {
  createCodUpfrontOrder,
  getCodPolicy,
  verifyCodUpfront,
} from "@lib/data/cod"
import { computeCodToken, type CodPolicy } from "@lib/util/cod"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import React, { useEffect, useState } from "react"
import ErrorMessage from "../error-message"

/**
 * Place-order CTA styled to match the site's gold theme buttons (rounded-full,
 * gold bg, plum text), with a built-in spinner while submitting.
 */
const ThemedPlaceOrderButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { isLoading?: boolean }
> = ({ isLoading, disabled, children, ...props }) => (
  <button
    {...props}
    disabled={disabled || isLoading}
    className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
  >
    {isLoading && (
      <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
    )}
    {children}
  </button>
)

// placeOrder() finishes by calling redirect() (to the confirmation page), which
// Next.js signals by throwing an error whose digest starts with "NEXT_REDIRECT".
// It must NOT be swallowed as a user-facing error — re-throw it so Next performs
// the navigation (otherwise "NEXT_REDIRECT" flashes on screen before the redirect).
const isRedirectError = (err: any): boolean => {
  const digest = err?.digest
  return (
    (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) ||
    err?.message === "NEXT_REDIRECT"
  )
}

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  "data-testid": string
}

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  "data-testid": dataTestId,
}) => {
  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const paymentSession = cart.payment_collection?.payment_sessions?.[0]

  switch (true) {
    case isRazorpay(paymentSession?.provider_id):
      return (
        <RazorpayPaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isCod(paymentSession?.provider_id):
      return (
        <CodPaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isManual(paymentSession?.provider_id):
      return (
        <ManualTestPaymentButton notReady={notReady} data-testid={dataTestId} />
      )
    default:
      return (
        <ThemedPlaceOrderButton disabled>
          Select a payment method
        </ThemedPlaceOrderButton>
      )
  }
}

const loadRazorpayScript = () =>
  new Promise<void>((resolve, reject) => {
    if ((window as any).Razorpay) return resolve()
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load Razorpay"))
    document.body.appendChild(script)
  })

const RazorpayPaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [hasFailed, setHasFailed] = useState(false)
  // True once Razorpay confirms a successful charge. Guards against re-charging
  // if placeOrder() fails afterwards — the retry just completes the order.
  const [paid, setPaid] = useState(false)

  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )

  const completeOrder = async () => {
    try {
      await placeOrder()
      setHasFailed(false)
    } catch (err: any) {
      if (isRedirectError(err)) throw err
      setErrorMessage(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Returns the freshest razorpay_order_id available. If the last attempt
  // failed (or no attempt yet but the session is stale), mints a new session
  // on the cart so Razorpay accepts the order_id.
  const ensureFreshOrderId = async (forceRefresh: boolean): Promise<{
    orderId: string
    amount: number
    currency: string
  }> => {
    if (!forceRefresh && session?.data) {
      const orderId = (session.data as any)?.razorpay_order_id
      if (orderId) {
        return {
          orderId,
          amount: (session.data as any)?.amount,
          currency: (session.data as any)?.currency || "INR",
        }
      }
    }
    await initiatePaymentSession(cart, { provider_id: "razorpay" })
    const refreshed = await retrieveCart(cart.id)
    const fresh = refreshed?.payment_collection?.payment_sessions?.find(
      (s: any) => s.status === "pending"
    )
    const newOrderId = (fresh?.data as any)?.razorpay_order_id
    if (!newOrderId) throw new Error("Could not refresh Razorpay order")
    return {
      orderId: newOrderId,
      amount: (fresh?.data as any)?.amount,
      currency: (fresh?.data as any)?.currency || "INR",
    }
  }

  const handlePayment = async (isRetry = false) => {
    setSubmitting(true)
    setErrorMessage(null)

    // Payment already succeeded on a prior attempt — don't re-open the popup
    // (would re-charge). Just retry completing the order.
    if (paid) {
      await completeOrder()
      return
    }

    try {
      const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
      if (!razorpayKeyId) throw new Error("Razorpay key not configured")

      const { orderId, amount, currency } = await ensureFreshOrderId(isRetry)
      await loadRazorpayScript()

      const options = {
        key: razorpayKeyId,
        amount,
        currency,
        name: process.env.NEXT_PUBLIC_BRAND_NAME || "Delfee",
        description: "Order Payment",
        order_id: orderId,
        prefill: {
          name: `${cart.billing_address?.first_name || ""} ${cart.billing_address?.last_name || ""}`.trim(),
          email: cart.email || "",
          contact: cart.billing_address?.phone || "",
        },
        theme: { color: "#5D2E46" },
        handler: async function () {
          // Razorpay confirmed the charge — mark paid so any later retry
          // completes the order rather than charging again.
          setPaid(true)
          await completeOrder()
        },
        modal: {
          ondismiss: function () {
            setSubmitting(false)
          },
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.on("payment.failed", function (response: any) {
        setErrorMessage(
          response.error?.description || "Payment failed. Please try again."
        )
        setHasFailed(true)
        setRetryCount((c) => c + 1)
        setSubmitting(false)
      })
      rzp.open()
    } catch (err: any) {
      setErrorMessage(err.message)
      setHasFailed(true)
      setSubmitting(false)
    }
  }

  return (
    <>
      <ThemedPlaceOrderButton
        disabled={notReady}
        onClick={() => handlePayment(hasFailed)}
        isLoading={submitting}
        data-testid={dataTestId}
      >
        {paid
          ? "Complete your order"
          : hasFailed
          ? retryCount > 1
            ? `Retry payment (attempt ${retryCount + 1})`
            : "Retry payment"
          : "Pay with Razorpay"}
      </ThemedPlaceOrderButton>
      <ErrorMessage
        error={errorMessage}
        data-testid="razorpay-payment-error-message"
      />
    </>
  )
}

const CodPaymentButton = ({
  notReady,
  cart,
  "data-testid": dataTestId,
}: {
  notReady: boolean
  cart: HttpTypes.StoreCart
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [policy, setPolicy] = useState<CodPolicy | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [hasFailed, setHasFailed] = useState(false)

  useEffect(() => {
    getCodPolicy().then(setPolicy).catch(() => {})
  }, [])

  const total = Number(cart?.total) || 0
  const upfrontAmount = policy ? computeCodToken(total, policy) : 0
  const upfrontRequired = upfrontAmount > 0
  const dueOnDelivery = Math.max(0, total - upfrontAmount)
  const currency = cart?.currency_code || "inr"
  const fmt = (amount: number) =>
    convertToLocale({ amount, currency_code: currency })

  const handlePayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)

    if (!upfrontRequired) {
      // Plain COD path — unchanged
      try {
        await placeOrder()
      } catch (err: any) {
        if (isRedirectError(err)) throw err
        setErrorMessage(err?.message || "Could not place order")
      } finally {
        setSubmitting(false)
      }
      return
    }

    // COD with upfront token
    try {
      const { data: tokenResp, error: createErr } = await createCodUpfrontOrder(
        cart.id
      )
      if (createErr || !tokenResp) {
        throw new Error(createErr || "Could not start the payment")
      }
      if (!tokenResp.upfront_required) {
        // Cart total dropped below the threshold between mount and click —
        // proceed as plain COD.
        await placeOrder()
        setSubmitting(false)
        return
      }
      if (tokenResp.already_paid) {
        // The token was already paid on a prior attempt (e.g. placeOrder failed
        // after payment). Don't re-charge — just complete the order.
        try {
          await placeOrder()
          setHasFailed(false)
        } catch (err: any) {
          if (isRedirectError(err)) throw err
          setErrorMessage(
            err?.message || "Could not complete the order after payment"
          )
        } finally {
          setSubmitting(false)
        }
        return
      }

      await loadRazorpayScript()

      const rzp = new (window as any).Razorpay({
        key: tokenResp.razorpay_key_id,
        amount: tokenResp.amount * 100, // paise
        currency: (tokenResp.currency || "inr").toUpperCase(),
        name: process.env.NEXT_PUBLIC_BRAND_NAME || "Delfee",
        description: "COD upfront token",
        order_id: tokenResp.razorpay_order_id,
        prefill: {
          name: `${cart.billing_address?.first_name || ""} ${cart.billing_address?.last_name || ""}`.trim(),
          email: cart.email || "",
          contact: cart.billing_address?.phone || "",
        },
        theme: { color: "#5D2E46" },
        handler: async (resp: any) => {
          try {
            const { verified, error: verr } = await verifyCodUpfront({
              cart_id: cart.id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            })
            if (!verified) throw new Error(verr || "Verification failed")
            await placeOrder()
            setHasFailed(false)
          } catch (err: any) {
            if (isRedirectError(err)) throw err
            setErrorMessage(
              err?.message || "Could not complete the order after payment"
            )
          } finally {
            setSubmitting(false)
          }
        },
        modal: {
          ondismiss: () => setSubmitting(false),
        },
      })
      rzp.on("payment.failed", (resp: any) => {
        setErrorMessage(
          resp.error?.description || "Payment failed. Please try again."
        )
        setHasFailed(true)
        setRetryCount((c) => c + 1)
        setSubmitting(false)
      })
      rzp.open()
    } catch (err: any) {
      if (isRedirectError(err)) throw err
      setErrorMessage(err?.message || "Could not start the payment")
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {upfrontRequired && (
        <div className="rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-3.5 text-[13px]">
          <p
            className="font-semibold text-[var(--color-plum)] mb-2"
            data-testid="cod-upfront-breakdown"
          >
            Cash on Delivery — payment breakdown
          </p>
          <div className="flex justify-between text-[var(--color-text-secondary)]">
            <span>
              {policy && total >= policy.threshold
                ? `${policy.percent}% advance token via Razorpay`
                : "Advance token via Razorpay"}{" "}
              <span className="text-[var(--color-text-muted)]">(now)</span>
            </span>
            <span className="font-semibold tabular-nums text-[var(--color-text-primary)]">
              {fmt(upfrontAmount)}
            </span>
          </div>
          <div className="flex justify-between text-[var(--color-text-secondary)] mt-1">
            <span>Due on delivery</span>
            <span className="font-semibold tabular-nums text-[var(--color-text-primary)]">
              {fmt(dueOnDelivery)}
            </span>
          </div>
        </div>
      )}
      <ThemedPlaceOrderButton
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        data-testid={dataTestId}
      >
        {hasFailed && upfrontRequired
          ? retryCount > 1
            ? `Retry payment (attempt ${retryCount + 1})`
            : "Retry payment"
          : upfrontRequired
          ? `Pay ${fmt(upfrontAmount)} & Place Order`
          : "Place Order (Cash on Delivery)"}
      </ThemedPlaceOrderButton>
      <ErrorMessage
        error={errorMessage}
        data-testid="cod-payment-error-message"
      />
    </div>
  )
}

const ManualTestPaymentButton = ({ notReady }: { notReady: boolean }) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        if (isRedirectError(err)) throw err
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const handlePayment = () => {
    setSubmitting(true)
    onPaymentCompleted()
  }

  return (
    <>
      <ThemedPlaceOrderButton
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        data-testid="submit-order-button"
      >
        Place order
      </ThemedPlaceOrderButton>
      <ErrorMessage
        error={errorMessage}
        data-testid="manual-payment-error-message"
      />
    </>
  )
}

export default PaymentButton
