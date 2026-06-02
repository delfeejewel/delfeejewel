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

      if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
        return {
          data: { ...data },
          status: PaymentSessionStatus.PENDING,
        }
      }

      // Verify signature
      const crypto = require("crypto")
      const generatedSignature = crypto
        .createHmac("sha256", this.options_.key_secret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex")

      if (generatedSignature !== razorpaySignature) {
        return {
          data: { ...data, error: "Invalid payment signature" },
          status: PaymentSessionStatus.ERROR,
        }
      }

      return {
        data: {
          ...data,
          razorpay_payment_id: razorpayPaymentId,
        },
        status: PaymentSessionStatus.AUTHORIZED,
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

  async getWebhookActionAndData(data: any): Promise<any> {
    const event = data.body?.event

    switch (event) {
      case "payment.captured":
        return {
          action: PaymentActions.SUCCESSFUL,
          data: {
            session_id: data.body?.payload?.payment?.entity?.notes?.session_id,
            amount: data.body?.payload?.payment?.entity?.amount,
          },
        }
      case "payment.failed":
        return {
          action: PaymentActions.FAILED,
          data: {
            session_id: data.body?.payload?.payment?.entity?.notes?.session_id,
          },
        }
      default:
        return { action: PaymentActions.NOT_SUPPORTED }
    }
  }
}

export default RazorpayProviderService
