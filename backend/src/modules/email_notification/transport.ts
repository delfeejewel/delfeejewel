import nodemailer from "nodemailer"
import { Resend } from "resend"

export type TransportType = "gmail" | "ses" | "smtp" | "resend"

export interface TransportConfig {
  type: TransportType
  from: string
  // Gmail
  gmail_user?: string
  gmail_app_password?: string
  // AWS SES
  ses_region?: string
  ses_access_key_id?: string
  ses_secret_access_key?: string
  // Generic SMTP
  smtp_host?: string
  smtp_port?: number
  smtp_user?: string
  smtp_pass?: string
  smtp_secure?: boolean
  // Resend (HTTP API — the only transport that works on hosts where outbound
  // SMTP ports 25/465/587 are blocked, e.g. our DigitalOcean droplet)
  resend_api_key?: string
}

// Minimal mailer contract shared by every transport. nodemailer's Transporter
// already satisfies this structurally; the Resend adapter implements it over
// the HTTP API. The service only ever calls sendMail(), so this is all it needs.
/** File attached to an outbound email (e.g. the GST invoice PDF). */
export type MailAttachment = {
  filename: string
  content: Buffer
}

export interface Mailer {
  sendMail(opts: {
    from: string
    to: string
    subject: string
    html: string
    attachments?: MailAttachment[]
  }): Promise<unknown>
}

// Fail fast instead of hanging on the nodemailer default connectionTimeout of
// 120s. On hosts where the SMTP egress port is blocked/filtered (common on
// cloud VMs), the TCP connect never completes — without these caps a single
// send would block for a full 2 minutes before erroring.
const TIMEOUTS = {
  connectionTimeout: 10_000, // wait max 10s for the TCP connection
  greetingTimeout: 10_000, // wait max 10s for the SMTP greeting
  socketTimeout: 20_000, // wait max 20s of socket inactivity
} as const

export function createTransport(config: TransportConfig): Mailer {
  switch (config.type) {
    case "resend":
      return createResendMailer(config.resend_api_key!)

    case "gmail":
      return nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: config.gmail_user,
          pass: config.gmail_app_password,
        },
        ...TIMEOUTS,
      })

    case "ses":
      return nodemailer.createTransport({
        host: `email-smtp.${config.ses_region || "ap-south-1"}.amazonaws.com`,
        port: 587,
        secure: false,
        auth: {
          user: config.ses_access_key_id!,
          pass: config.ses_secret_access_key!,
        },
        ...TIMEOUTS,
      })

    case "smtp":
      return nodemailer.createTransport({
        host: config.smtp_host,
        port: config.smtp_port || 587,
        secure: config.smtp_secure ?? false,
        auth: {
          user: config.smtp_user,
          pass: config.smtp_pass,
        },
        ...TIMEOUTS,
      })

    default:
      throw new Error(`Unsupported email transport type: ${config.type}`)
  }
}

// Resend speaks HTTPS, not SMTP, so it sails through the droplet's blocked SMTP
// egress. The SDK resolves with { error } rather than throwing on an API
// failure, so we re-throw to match nodemailer's throw-on-failure contract that
// the service's try/catch (and the "Send test" button) rely on.
function createResendMailer(apiKey: string): Mailer {
  const resend = new Resend(apiKey)
  return {
    async sendMail({ from, to, subject, html, attachments }) {
      const { data, error } = await resend.emails.send({
        from,
        to,
        subject,
        html,
        // Resend takes attachment content as base64 (or a Buffer); nodemailer
        // takes a Buffer. We normalise on Buffer in MailAttachment and convert
        // here so callers don't care which transport is configured.
        ...(attachments?.length
          ? {
              attachments: attachments.map((a) => ({
                filename: a.filename,
                content: a.content.toString("base64"),
              })),
            }
          : {}),
      })
      if (error) {
        throw new Error(error.message || "Resend API error")
      }
      return data
    },
  }
}
