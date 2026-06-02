import {
  AbstractPaymentProvider,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"

type CodOptions = {
  // No config needed for COD
}

type InjectedDependencies = {
  logger: any
}

class CodProviderService extends AbstractPaymentProvider<CodOptions> {
  static identifier = "cod"

  protected logger_: any

  constructor(container: InjectedDependencies, options: CodOptions) {
    super(container, options)
    this.logger_ = container.logger
    this.logger_.info("COD (Cash on Delivery) payment provider initialized")
  }

  async initiatePayment(input: any): Promise<any> {
    return {
      data: {
        status: "pending",
        method: "cash_on_delivery",
        amount: input.amount,
        currency: input.currency_code,
      },
    }
  }

  async authorizePayment(input: any): Promise<any> {
    // COD is always authorized — payment collected on delivery
    return {
      data: { ...input.data, authorized: true },
      status: PaymentSessionStatus.AUTHORIZED,
    }
  }

  async capturePayment(input: any): Promise<any> {
    // Admin manually captures when cash is collected
    return {
      data: { ...input.data, captured: true, captured_at: new Date().toISOString() },
    }
  }

  async refundPayment(input: any): Promise<any> {
    // Manual refund for COD
    return {
      data: {
        ...input.data,
        refunded: true,
        refund_amount: input.amount,
        refunded_at: new Date().toISOString(),
      },
    }
  }

  async cancelPayment(input: any): Promise<any> {
    return {
      data: { ...input.data, canceled: true },
    }
  }

  async deletePayment(input: any): Promise<any> {
    return { data: {} }
  }

  async getPaymentStatus(input: any): Promise<any> {
    const { data } = input

    if (data?.captured) {
      return { status: PaymentSessionStatus.AUTHORIZED }
    }

    if (data?.canceled) {
      return { status: PaymentSessionStatus.CANCELED }
    }

    if (data?.authorized) {
      return { status: PaymentSessionStatus.AUTHORIZED }
    }

    return { status: PaymentSessionStatus.PENDING }
  }

  async retrievePayment(input: any): Promise<any> {
    return { data: { ...input.data } }
  }

  async updatePayment(input: any): Promise<any> {
    return { data: { ...input.data } }
  }

  async getWebhookActionAndData(data: any): Promise<any> {
    return { action: PaymentActions.NOT_SUPPORTED }
  }
}

export default CodProviderService
