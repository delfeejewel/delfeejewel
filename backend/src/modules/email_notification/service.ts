import { MedusaService } from "@medusajs/framework/utils"
import { createTransport, Mailer } from "./transport"
import { getEmailSender } from "../../utils/get-email-sender"
import {
  templates,
  OrderEmailData,
  giftCardPurchasedTemplate,
  GiftCardEmailData,
  rtoRefundProcessedTemplate,
  RtoRefundEmailData,
  rtoProcessedAdminTemplate,
  RtoAdminEmailData,
  lowStockDigestTemplate,
  LowStockEmailData,
  returnSubmittedTemplate,
  returnApprovedTemplate,
  returnRejectedTemplate,
  returnCompletedTemplate,
  returnAdminAlertTemplate,
  exchangeSubmittedTemplate,
  exchangeApprovedTemplate,
  replacementShippedTemplate,
  abandonedCartRecoveryTemplate,
  ReturnEmailData,
  ReturnCompletedEmailData,
  ReturnAdminEmailData,
  ExchangeEmailData,
  ReplacementShippedEmailData,
  AbandonedCartEmailData,
  otpVerifyTemplate,
  OtpEmailData,
  passwordResetTemplate,
  PasswordResetEmailData,
  contactNotificationTemplate,
  ContactNotificationData,
} from "./templates"
import { Logger } from "@medusajs/framework/types"

type InjectedDependencies = {
  logger: Logger
}

export default class EmailNotificationService extends MedusaService({}) {
  // Transport is built lazily from the CMS sender config, and rebuilt only when
  // that config changes (keyed by a signature of the resolved config).
  private transporter: Mailer | null = null
  private transporterKey = ""
  private logger: Logger

  constructor(container: InjectedDependencies) {
    super(...arguments)
    this.logger = container.logger
    this.logger.info(
      "Email notification service initialized (sender configured via CMS)"
    )
  }

  // Resolve the current sender from the CMS. Returns null when no valid sender
  // is configured — in that case no email should be sent.
  private async getMailer(
    forceRefresh = false
  ): Promise<{ transporter: Mailer; from: string } | null> {
    const config = await getEmailSender(forceRefresh)
    if (!config) return null

    const key = JSON.stringify(config)
    if (!this.transporter || this.transporterKey !== key) {
      try {
        this.transporter = createTransport(config)
        this.transporterKey = key
      } catch (e: any) {
        this.logger.error(`Failed to build email transport: ${e.message}`)
        this.transporter = null
        this.transporterKey = ""
        return null
      }
    }
    return { transporter: this.transporter, from: config.from }
  }

  // Central send wrapper. Every outbound email funnels through here, so a
  // missing/incomplete CMS sender disables ALL email in one place.
  private async _send(
    label: string,
    to: string | undefined,
    subject: string,
    html: string,
    attachments?: { filename: string; content: Buffer }[]
  ): Promise<void> {
    if (!to) {
      this.logger.warn(`Email skipped (${label}): no recipient`)
      return
    }

    const mailer = await this.getMailer()
    if (!mailer) {
      this.logger.warn(
        `Email skipped (${label} → ${to}): no email sender configured in CMS`
      )
      return
    }

    try {
      await mailer.transporter.sendMail({
        from: mailer.from,
        to,
        subject,
        html,
        ...(attachments?.length ? { attachments } : {}),
      })
      this.logger.info(
        `Email sent: ${label} to ${to}${
          attachments?.length ? ` (+${attachments.length} attachment)` : ""
        }`
      )
    } catch (error: any) {
      this.logger.error(`Failed to send email (${label}) to ${to}: ${error.message}`)
    }
  }

  // Send a one-off test email to verify the configured sender works. Unlike
  // the fire-and-forget _send wrapper, this surfaces the real outcome (and
  // bypasses the sender cache) so the CMS "Send test" button can report it.
  async sendTestEmail(
    to: string
  ): Promise<{ ok: boolean; message: string; code?: number }> {
    const mailer = await this.getMailer(true)
    if (!mailer) {
      return {
        ok: false,
        code: 400,
        message: "No email sender is configured in the CMS.",
      }
    }

    const subject = "Test email from your store"
    const html = `
      <div style="font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
        <h2 style="margin:0 0 12px;font-family:'Wittgenstein',Georgia,'Times New Roman',serif;color:#5D2E46">✅ Email sender is working</h2>
        <p style="margin:0 0 8px">This is a test email sent from your store's configured sender.</p>
        <p style="margin:0;color:#666;font-size:13px">Sent from: ${mailer.from}</p>
      </div>`

    try {
      await mailer.transporter.sendMail({ from: mailer.from, to, subject, html })
      this.logger.info(`Test email sent to ${to}`)
      return { ok: true, message: `Test email sent to ${to}` }
    } catch (error: any) {
      this.logger.error(`Test email failed to ${to}: ${error.message}`)
      return {
        ok: false,
        code: 502,
        message: error.message || "Failed to send test email",
      }
    }
  }

  /**
   * Send one marketing-campaign email. Unlike the fire-and-forget _send,
   * this RETURNS the per-recipient outcome so the campaign sender can tally
   * sent vs failed. The HTML is already fully rendered (incl. the compliance
   * footer + unsubscribe link) by the caller.
   */
  async sendCampaignEmail(args: {
    to: string
    subject: string
    html: string
  }): Promise<{ ok: boolean; error?: string }> {
    const mailer = await this.getMailer()
    if (!mailer) {
      return { ok: false, error: "No email sender configured in CMS" }
    }
    try {
      await mailer.transporter.sendMail({
        from: mailer.from,
        to: args.to,
        subject: args.subject,
        html: args.html,
      })
      return { ok: true }
    } catch (error: any) {
      return { ok: false, error: error?.message || "send failed" }
    }
  }

  /**
   * Appointment lifecycle email (booked / confirmed / cancelled). HTML is built
   * inline (no template-registry entry needed). Fire-and-forget via _send.
   */
  async sendAppointmentEmail(data: {
    to: string
    kind: "booked" | "confirmed" | "cancelled"
    name: string
    reference: string
    service_type: string
    date: string
    slot: string
    reason?: string
  }): Promise<void> {
    const prettyDate = (() => {
      const [y, m, d] = data.date.split("-").map(Number)
      const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1))
      return dt.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    })()

    const headline =
      data.kind === "cancelled"
        ? "Your appointment was cancelled"
        : data.kind === "confirmed"
        ? "Your appointment is confirmed"
        : "Your appointment is booked"

    const intro =
      data.kind === "cancelled"
        ? `Hi ${data.name}, your appointment below has been cancelled.${
            data.reason ? ` Reason: ${data.reason}.` : ""
          } Please book again or contact us to reschedule.`
        : `Hi ${data.name}, thank you for booking a visit. We look forward to seeing you at our Chandigarh store.`

    const subject =
      data.kind === "cancelled"
        ? `Appointment cancelled — ${data.reference}`
        : `Appointment ${data.kind === "confirmed" ? "confirmed" : "booked"} — ${data.reference}`

    const struck = data.kind === "cancelled"
    const row = (label: string, value: string) =>
      `<tr><td style="padding:4px 12px 4px 0;color:#888;font-size:13px">${label}</td>` +
      `<td style="padding:4px 0;font-size:14px;color:#1a1a1a${
        struck ? ";text-decoration:line-through;color:#999" : ""
      }">${value}</td></tr>`

    const html = `
      <div style="font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#1a1a1a">
        <h2 style="margin:0 0 8px;font-family:'Wittgenstein',Georgia,'Times New Roman',serif;color:#5D2E46">${headline}</h2>
        <p style="margin:0 0 16px;color:#444;font-size:14px;line-height:1.5">${intro}</p>
        <table style="border-collapse:collapse;margin:0 0 16px">
          ${row("Reference", data.reference)}
          ${row("For", data.service_type)}
          ${row("Date", prettyDate)}
          ${row("Time", data.slot)}
        </table>
        <p style="margin:0;color:#888;font-size:12px">Please keep your reference handy. Need to change your visit? Just reply to this email.</p>
      </div>`

    await this._send(`appointment.${data.kind} ${data.reference}`, data.to, subject, html)
  }

  async sendOrderEmail(
    templateName: keyof typeof templates,
    data: OrderEmailData,
    attachments?: { filename: string; content: Buffer }[]
  ) {
    const template = templates[templateName]
    if (!template) {
      this.logger.error(`Email template not found: ${templateName}`)
      return
    }
    const { subject, html } = template(data)
    await this._send(
      `${templateName} #${data.order_number}`,
      data.customer_email,
      subject,
      html,
      attachments
    )
  }

  async sendRtoRefundEmail(data: RtoRefundEmailData) {
    const { subject, html } = rtoRefundProcessedTemplate(data)
    await this._send(
      `rto.refund #${data.order_number}`,
      data.customer_email,
      subject,
      html
    )
  }

  async sendRtoAdminEmail(data: RtoAdminEmailData) {
    const { subject, html } = rtoProcessedAdminTemplate(data)
    await this._send(`rto.admin #${data.order_number}`, data.to, subject, html)
  }

  async sendLowStockDigest(data: LowStockEmailData) {
    if (!data.items?.length) return
    const { subject, html } = lowStockDigestTemplate(data)
    await this._send(`low-stock (${data.items.length})`, data.to, subject, html)
  }

  async sendReturnSubmittedEmail(data: ReturnEmailData) {
    const { subject, html } = returnSubmittedTemplate(data)
    await this._send("return.submitted", data.customer_email, subject, html)
  }
  async sendReturnApprovedEmail(data: ReturnEmailData) {
    const { subject, html } = returnApprovedTemplate(data)
    await this._send("return.approved", data.customer_email, subject, html)
  }
  async sendReturnRejectedEmail(data: ReturnEmailData) {
    const { subject, html } = returnRejectedTemplate(data)
    await this._send("return.rejected", data.customer_email, subject, html)
  }
  async sendReturnCompletedEmail(data: ReturnCompletedEmailData) {
    const { subject, html } = returnCompletedTemplate(data)
    await this._send("return.completed", data.customer_email, subject, html)
  }
  async sendExchangeSubmittedEmail(data: ExchangeEmailData) {
    const { subject, html } = exchangeSubmittedTemplate(data)
    await this._send("exchange.submitted", data.customer_email, subject, html)
  }
  async sendExchangeApprovedEmail(data: ExchangeEmailData) {
    const { subject, html } = exchangeApprovedTemplate(data)
    await this._send("exchange.approved", data.customer_email, subject, html)
  }
  async sendReplacementShippedEmail(data: ReplacementShippedEmailData) {
    const { subject, html } = replacementShippedTemplate(data)
    await this._send("replacement.shipped", data.customer_email, subject, html)
  }
  async sendAbandonedCartRecoveryEmail(data: AbandonedCartEmailData) {
    const { subject, html } = abandonedCartRecoveryTemplate(data)
    await this._send("abandoned-cart", data.customer_email, subject, html)
  }
  async sendReturnAdminAlertEmail(data: ReturnAdminEmailData) {
    const { subject, html } = returnAdminAlertTemplate(data)
    await this._send("return.admin-alert", data.to, subject, html)
  }

  async sendOtpEmail(data: OtpEmailData) {
    const { subject, html } = otpVerifyTemplate(data)
    await this._send("otp.verify", data.email, subject, html)
  }

  async sendPasswordResetEmail(data: PasswordResetEmailData) {
    const { subject, html } = passwordResetTemplate(data)
    await this._send("password.reset", data.email, subject, html)
  }

  async sendGiftCardEmail(data: GiftCardEmailData) {
    const { subject, html } = giftCardPurchasedTemplate(data)
    await this._send(
      `gift-card ${data.code}`,
      data.recipient_email,
      subject,
      html
    )
  }

  async sendContactNotificationEmail(data: ContactNotificationData) {
    const { subject, html } = contactNotificationTemplate(data)
    await this._send(`contact ${data.email}`, data.to, subject, html)
  }
}
