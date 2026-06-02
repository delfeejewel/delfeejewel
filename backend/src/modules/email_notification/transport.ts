import nodemailer, { Transporter } from "nodemailer"

export type TransportType = "gmail" | "ses" | "smtp"

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
}

export function createTransport(config: TransportConfig): Transporter {
  switch (config.type) {
    case "gmail":
      return nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: config.gmail_user,
          pass: config.gmail_app_password,
        },
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
      })

    default:
      throw new Error(`Unsupported email transport type: ${config.type}`)
  }
}
