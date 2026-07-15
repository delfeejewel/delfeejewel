import {
  AbstractPaymentProvider,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import Razorpay from "razorpay"

type RazorpayOptions = {
  key_id: string
  key_secret: string
  webhook_secret?: string
}

type InjectedDependencies = {
  logger: any
}

class RazorpayProviderService extends AbstractPaymentProvider<RazorpayOptions> {
  static identifier = "razorpay"

  protected razorpay_: InstanceType<typeof Razorpay>
  protected options_: RazorpayOptions
  protected logger_: any

  constructor(container: InjectedDependencies, options: RazorpayOptions) {
    super(container, options)

    this.options_ = options
    this.logger_ = container.logger

    this.logger_.info(`Razorpay options received — key_id: ${options.key_id ? options.key_id.substring(0, 12) + "..." : "MISSING"}`)

    this.razorpay_ = new Razorpay({
      key_id: options.key_id,
      key_secret: options.key_secret,
    })

    this.logger_.info("Razorpay payment provider initialized")
  }

  static validateOptions(options: Record<string, any>) {
    if (!options.key_id) {
      throw new Error("Razorpay key_id is required")
    }
    if (!options.key_secret) {
      throw new Error("Razorpay key_secret is required")
    }
  }

  async initiatePayment(input: any): Promise<any> {
    const { amount, currency_code, context } = input

    this.logger_.info(`Razorpay initiatePayment — amount received: ${amount}, currency: ${currency_code}`)

    // Medusa passes amount in rupees (e.g. 32097 = ₹32,097)
    // Razorpay expects amount in paise (e.g. 3209700 = ₹32,097)
    const amountInPaise = Math.round(amount * 100)

    try {
      const order = await this.razorpay_.orders.create({
        amount: amountInPaise,
        currency: currency_code.toUpperCase(),
        receipt: context?.session_id || `receipt_${Date.now()}`,
        notes: {
          session_id: context?.session_id || "",
        },
      })

      return {
        data: {
          razorpay_order_id: order.id,
          razorpay_key_id: this.options_.key_id,
          amount: order.amount,
          currency: order.currency,
          status: order.status,
        },
      }
    } catch (error: any) {
      this.logger_.error(`Razorpay initiatePayment error: ${error.message}`)
      throw error
    }
  }

  async authorizePayment(input: any): Promise<any> {
    const { data } = input

    try {
      const razorpayPaymentId = data?.razorpay_payment_id
      const razorpayOrderId = data?.razorpay_order_id
      const razorpaySignature = data?.razorpay_signature

      // The trusted expected amount (paise) was set by OUR initiatePayment on
      // the session data — it is not client-writable through the store API.
      // Every authorization path below is checked against it so a valid-but-
      // cheaper payment (or a different Razorpay order) can never authorize an
      // expensive cart.
      const expectedPaise =
        data?.amount != null ? Math.round(Number(data.amount)) : undefined
      if (!razorpayOrderId) {
        // No order was ever initiated for this session → cannot be paid.
        return { data: { ...data }, status: PaymentSessionStatus.PENDING }
      }
      if (expectedPaise == null || !Number.isFinite(expectedPaise)) {
        this.logger_.error(
          "Razorpay authorizePayment: session is missing the expected amount — refusing to authorize"
        )
        return {
          data: { ...data, error: "Missing expected amount" },
          status: PaymentSessionStatus.ERROR,
        }
      }

      const amountMatches = (paise: any) =>
        Number(paise) === expectedPaise

      // If a signed callback was supplied, verify the signature first. This
      // only proves the (order, payment) pair is authentic — it does NOT prove
      // the order/amount is the one we initiated, so we still fall through to
      // the server-to-server amount check below.
      if (razorpayPaymentId && razorpaySignature) {
        const crypto = require("crypto")
        const generatedSignature = crypto
          .createHmac("sha256", this.options_.key_secret)
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest("hex")

        const sigBuf = Buffer.from(String(razorpaySignature))
        const expBuf = Buffer.from(generatedSignature)
        const sigOk =
          sigBuf.length === expBuf.length &&
          crypto.timingSafeEqual(sigBuf, expBuf)
        if (!sigOk) {
          return {
            data: { ...data, error: "Invalid payment signature" },
            status: PaymentSessionStatus.ERROR,
          }
        }
      }

      // Authoritative check: ask Razorpay (authenticated, server-to-server)
      // for the payments on THIS session's order and require a captured/
      // authorized one whose amount matches what we initiated.
      const { items } = await this.razorpay_.orders.fetchPayments(razorpayOrderId)
      const paid = (items || []).find(
        (p: any) =>
          (p.status === "captured" || p.status === "authorized") &&
          amountMatches(p.amount)
      )
      if (paid) {
        return {
          data: { ...data, razorpay_payment_id: paid.id },
          status: PaymentSessionStatus.AUTHORIZED,
        }
      }

      // A payment exists but the amount doesn't match → tampering / drift.
      const anyPaid = (items || []).find(
        (p: any) => p.status === "captured" || p.status === "authorized"
      )
      if (anyPaid) {
        this.logger_.warn(
          `Razorpay authorizePayment: amount mismatch on order ${razorpayOrderId} — paid ${anyPaid.amount}, expected ${expectedPaise}`
        )
        return {
          data: { ...data, error: "Payment amount does not match order" },
          status: PaymentSessionStatus.ERROR,
        }
      }

      // No payment yet → leave it pending.
      return {
        data: { ...data },
        status: PaymentSessionStatus.PENDING,
      }
    } catch (error: any) {
      this.logger_.error(`Razorpay authorizePayment error: ${error.message}`)
      return {
        data: { ...data, error: error.message },
        status: PaymentSessionStatus.ERROR,
      }
    }
  }

  async capturePayment(input: any): Promise<any> {
    const { data } = input
    const paymentId = data?.razorpay_payment_id

    try {
      if (paymentId) {
        const payment = await this.razorpay_.payments.fetch(paymentId)

        if (payment.status === "captured") {
          return { data: { ...data, captured: true } }
        }

        await this.razorpay_.payments.capture(paymentId, payment.amount, payment.currency)
      }

      return { data: { ...data, captured: true } }
    } catch (error: any) {
      this.logger_.error(`Razorpay capturePayment error: ${error.message}`)
      throw error
    }
  }

  async refundPayment(input: any): Promise<any> {
    const { data, amount } = input
    const paymentId = data?.razorpay_payment_id

    try {
      if (paymentId) {
        const refund = await this.razorpay_.payments.refund(paymentId, {
          amount: Math.round(amount * 100),
        })

        return {
          data: {
            ...data,
            refund_id: refund.id,
            refund_status: refund.status,
          },
        }
      }

      return { data: { ...data } }
    } catch (error: any) {
      this.logger_.error(`Razorpay refundPayment error: ${error.message}`)
      throw error
    }
  }

  async cancelPayment(input: any): Promise<any> {
    return { data: { ...input.data, canceled: true } }
  }

  async deletePayment(input: any): Promise<any> {
    return { data: { ...input.data } }
  }

  async getPaymentStatus(input: any): Promise<any> {
    const { data } = input

    if (data?.razorpay_payment_id) {
      try {
        const payment = await this.razorpay_.payments.fetch(data.razorpay_payment_id)

        switch (payment.status) {
          case "captured":
            return { status: PaymentSessionStatus.AUTHORIZED }
          case "authorized":
            return { status: PaymentSessionStatus.AUTHORIZED }
          case "failed":
            return { status: PaymentSessionStatus.ERROR }
          case "refunded":
            return { status: PaymentSessionStatus.AUTHORIZED }
          default:
            return { status: PaymentSessionStatus.PENDING }
        }
      } catch (error: any) {
        return { status: PaymentSessionStatus.ERROR }
      }
    }

    return { status: PaymentSessionStatus.PENDING }
  }

  async retrievePayment(input: any): Promise<any> {
    const { data } = input

    if (data?.razorpay_payment_id) {
      const payment = await this.razorpay_.payments.fetch(data.razorpay_payment_id)
      return { data: { ...data, payment_details: payment } }
    }

    return { data: { ...data } }
  }

  async updatePayment(input: any): Promise<any> {
    return { data: { ...input.data } }
  }

  async getWebhookActionAndData(payload: any): Promise<any> {
    // Medusa passes { data: parsedBody, rawData: Buffer, headers } here.
    // NEVER trust the parsed body without first verifying the HMAC signature
    // Razorpay computed over the raw bytes — otherwise anyone can POST a
    // forged "payment.captured" to the auto-mounted /hooks/payment/razorpay
    // route and mark a session paid.
    const crypto = require("crypto")
    const secret =
      this.options_.webhook_secret || process.env.RAZORPAY_WEBHOOK_SECRET

    if (!secret) {
      this.logger_.error(
        "Razorpay getWebhookActionAndData: webhook_secret not configured — ignoring event"
      )
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    const headers = payload?.headers || {}
    const signatureRaw =
      headers["x-razorpay-signature"] || headers["X-Razorpay-Signature"]
    const signature = Array.isArray(signatureRaw) ? signatureRaw[0] : signatureRaw

    let raw: Buffer | undefined = payload?.rawData
    if (raw && (raw as any).type === "Buffer" && Array.isArray((raw as any).data)) {
      raw = Buffer.from((raw as any).data)
    } else if (typeof raw === "string") {
      raw = Buffer.from(raw, "utf8")
    }

    if (!signature || !raw) {
      this.logger_.warn(
        "Razorpay getWebhookActionAndData: missing signature or raw body"
      )
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex")
    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expected)
    const valid =
      sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)
    if (!valid) {
      this.logger_.warn("Razorpay getWebhookActionAndData: invalid signature")
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    // Signature verified — parse from the raw bytes we authenticated.
    let body: any
    try {
      body = JSON.parse(raw.toString("utf8"))
    } catch {
      body = payload?.data
    }
    const entity = body?.payload?.payment?.entity
    // Razorpay amounts are in paise; this provider works in rupees.
    const amount =
      entity?.amount != null ? Math.round(Number(entity.amount) / 100) : undefined

    switch (body?.event) {
      case "payment.captured":
        return {
          action: PaymentActions.SUCCESSFUL,
          data: {
            session_id: entity?.notes?.session_id,
            amount,
          },
        }
      case "payment.failed":
        return {
          action: PaymentActions.FAILED,
          data: {
            session_id: entity?.notes?.session_id,
            amount,
          },
        }
      default:
        return { action: PaymentActions.NOT_SUPPORTED }
    }
  }
}

export default RazorpayProviderService
