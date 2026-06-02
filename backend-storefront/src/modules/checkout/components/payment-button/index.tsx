"use client"

import { isCod, isManual, isRazorpay } from "@lib/constants"
import { initiatePaymentSession, placeOrder, retrieveCart } from "@lib/data/cart"
import {
  createCodUpfrontOrder,
  getCodPolicy,
  verifyCodUpfront,
  type CodPolicy,
} from "@lib/data/cod"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@medusajs/ui"
import React, { useEffect, useState } from "react"
import ErrorMessage from "../error-message"

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
      return <Button disabled>Select a payment method</Button>
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

  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )

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
        theme: { color: "#6b7280" },
        handler: async function () {
          try {
            await placeOrder()
            setHasFailed(false)
          } catch (err: any) {
            setErrorMessage(err.message)
          }
          setSubmitting(false)
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
      <Button
        disabled={notReady}
        onClick={() => handlePayment(hasFailed)}
        size="large"
        isLoading={submitting}
        data-testid={dataTestId}
      >
        {hasFailed
          ? retryCount > 1
            ? `Retry payment (attempt ${retryCount + 1})`
            : "Retry payment"
          : "Pay with Razorpay"}
      </Button>
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
  const upfrontAmount =
    policy && total >= policy.min_order
      ? Math.round((total * policy.percent) / 100)
      : 0
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
              {policy?.percent}% token via Razorpay{" "}
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
      <Button
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        data-testid={dataTestId}
      >
        {hasFailed && upfrontRequired
          ? retryCount > 1
            ? `Retry payment (attempt ${retryCount + 1})`
            : "Retry payment"
          : upfrontRequired
          ? `Pay ${fmt(upfrontAmount)} & Place Order`
          : "Place Order (Cash on Delivery)"}
      </Button>
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
      <Button
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        data-testid="submit-order-button"
      >
        Place order
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="manual-payment-error-message"
      />
    </>
  )
}

export default PaymentButton
