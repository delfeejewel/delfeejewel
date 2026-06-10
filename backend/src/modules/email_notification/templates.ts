export interface OrderEmailData {
  order_id: string
  order_number: string | number
  customer_name: string
  customer_email: string
  total: string
  /** Pre-formatted line totals for the amount breakdown (order.placed). */
  subtotal?: string
  shipping?: string
  shipping_is_free?: boolean
  discount?: string
  /** COD partial payment (set only when an upfront token was collected). */
  cod_paid?: string
  cod_due?: string
  items: { title: string; quantity: number; price: string }[]
  shipping_address?: string
  tracking_number?: string
  /** Signed token for the "Track your order" link — opens the order without re-entering email. */
  track_token?: string
  brand_name: string
}

/** Capitalise each word of a name for greetings ("testing" → "Testing"). */
function titleCase(s: string): string {
  return (s || "").trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

/** COD partial-payment note (advance token paid now + balance due on delivery). */
function codBlock(data: OrderEmailData): string {
  if (!data.cod_paid) return ""
  return `
  <div style="margin-top:18px;padding:14px 16px;border-radius:10px;background:#faf8f5;border:1px solid #ece8e2;">
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#5D2E46;">Cash on Delivery</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="padding:4px 0;font-size:13.5px;color:#666;">Advance paid (token)</td>
        <td style="padding:4px 0;font-size:13.5px;color:#2a2a2a;text-align:right;">${data.cod_paid}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:13.5px;color:#666;">Due on delivery</td>
        <td style="padding:4px 0;font-size:14px;font-weight:700;color:#5D2E46;text-align:right;">${data.cod_due}</td>
      </tr>
    </table>
  </div>`
}

/** Amount breakdown (subtotal / shipping / discount / total) for order emails. */
function totalsBlock(data: OrderEmailData): string {
  const line = (label: string, value: string) => `
    <tr>
      <td style="padding:7px 0;font-size:13.5px;color:#666;">${label}</td>
      <td style="padding:7px 0;font-size:13.5px;color:#2a2a2a;text-align:right;">${value}</td>
    </tr>`
  const rows: string[] = []
  if (data.subtotal) rows.push(line("Subtotal", data.subtotal))
  if (data.shipping || data.shipping_is_free)
    rows.push(line("Shipping", data.shipping || "Free"))
  if (data.discount) rows.push(line("Discount", data.discount))
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:10px;">
    ${rows.join("")}
    <tr>
      <td style="padding:14px 0 0;border-top:2px solid #e7e3dd;font-size:16px;font-weight:700;color:#5D2E46;">Total</td>
      <td style="padding:14px 0 0;border-top:2px solid #e7e3dd;font-size:16px;font-weight:700;color:#5D2E46;text-align:right;">${data.total}</td>
    </tr>
  </table>`
}

/** Storefront origin used for links and hosted assets (logo) in emails. */
function storefrontBase(): string {
  return (process.env.STOREFRONT_URL || "http://localhost:8000").replace(/\/$/, "")
}

/** Build the storefront "Track your order" URL, including the signed token when available. */
function trackOrderUrl(data: OrderEmailData): string {
  const token = data.track_token ? `&t=${encodeURIComponent(data.track_token)}` : ""
  return `${storefrontBase()}/track-order?order=${data.order_number}${token}`
}

export interface OtpEmailData {
  email: string
  code: string
  customer_name?: string
}

/** One-time code email used to confirm an email at post-checkout account creation. */
export function otpVerifyTemplate(data: OtpEmailData) {
  return {
    subject: "Your verification code",
    html: baseLayout(`
      <h2>Confirm your email</h2>
      <p>Hi ${titleCase(data.customer_name || "there")},</p>
      <p>Use this code to confirm your email and create your account:</p>
      <div style="background:#f5f5f7;padding:20px;border-radius:8px;text-align:center;margin:24px 0;">
        <span style="font-size:34px;font-weight:700;letter-spacing:10px;font-family:monospace;color:#1a1a1a;">${data.code}</span>
      </div>
      <p style="color:#999;font-size:13px;">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.</p>
    `),
  }
}

export interface PasswordResetEmailData {
  email: string
  code: string
  customer_name?: string
}

/** One-time code email for resetting a forgotten password. */
export function passwordResetTemplate(data: PasswordResetEmailData) {
  return {
    subject: "Reset your password",
    html: baseLayout(`
      <h2>Reset your password</h2>
      <p>Hi ${titleCase(data.customer_name || "there")},</p>
      <p>Use this code to reset your password:</p>
      <div style="background:#f5f5f7;padding:20px;border-radius:8px;text-align:center;margin:24px 0;">
        <span style="font-size:34px;font-weight:700;letter-spacing:10px;font-family:monospace;color:#1a1a1a;">${data.code}</span>
      </div>
      <p style="color:#999;font-size:13px;">This code expires in 10 minutes. If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>
    `),
  }
}

const BRAND_NAME = process.env.BRAND_NAME || "Delfee"

function baseLayout(content: string): string {
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${BRAND_NAME}</title>
  <style>
    body { margin:0; padding:0; }
    a { color:#5D2E46; }
    .content h2 { font-family:Georgia,'Times New Roman',serif; font-size:22px; font-weight:600; color:#2b2b2b; margin:0 0 14px; }
    .content h3 { margin:28px 0 14px; font-size:12px; text-transform:uppercase; letter-spacing:2px; color:#a59bad; font-weight:600; }
    .content p { margin:0 0 16px; line-height:1.65; font-size:14px; color:#555; }
    .content strong { color:#2b2b2b; }
    .btn { display:inline-block; padding:14px 38px; background:#5D2E46; color:#ffffff !important; text-decoration:none; border-radius:999px; font-size:13px; font-weight:600; letter-spacing:1px; text-transform:uppercase; }
    @media (max-width:620px){ .px { padding-left:22px !important; padding-right:22px !important; } }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f1ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ed;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(45,30,50,0.06);">
        <tr><td style="background:#5D2E46;padding:34px 32px;text-align:center;">
          <img src="${storefrontBase()}/images/logo-light.png" alt="${BRAND_NAME}" width="150" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0;outline:none;text-decoration:none;font-family:Georgia,'Times New Roman',serif;font-size:24px;letter-spacing:6px;text-transform:uppercase;color:#ffffff;font-weight:600;">
          <div style="height:1px;width:46px;background:#c9ccd1;margin:18px auto 0;line-height:1px;font-size:0;">&nbsp;</div>
        </td></tr>
        <tr><td class="content px" style="padding:38px 34px;">
          ${content}
        </td></tr>
        <tr><td class="px" style="padding:26px 34px;background:#faf8f5;text-align:center;border-top:1px solid #ece8e2;">
          <p style="margin:0 0 6px;font-size:12px;color:#8a8a8a;line-height:1.6;">Need help? Email us at <a href="mailto:enquire@delfee.in" style="color:#5D2E46;text-decoration:none;">enquire@delfee.in</a></p>
          <p style="margin:0;font-size:11px;color:#b3b0ab;line-height:1.6;">&copy; ${year} ${BRAND_NAME}. All rights reserved.<br>This is an automated message — please don't reply directly.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function itemsTable(items: OrderEmailData["items"]): string {
  const rows = items
    .map(
      (item) => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #efece7;font-size:14px;color:#2a2a2a;">
        ${item.title}<span style="color:#9b9b9b;font-size:13px;">&nbsp;&times;&nbsp;${item.quantity}</span>
      </td>
      <td style="padding:14px 0;border-bottom:1px solid #efece7;font-size:14px;color:#2a2a2a;font-weight:600;text-align:right;white-space:nowrap;">
        ${item.price}
      </td>
    </tr>`
    )
    .join("")
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`
}

export const templates = {
  "order.placed": (data: OrderEmailData) => ({
    subject: `Order Confirmed — #${data.order_number}`,
    html: baseLayout(`
      <h2>Your order is confirmed</h2>
      <p>Hi ${titleCase(data.customer_name)},</p>
      <p>Thank you for shopping with ${BRAND_NAME}. We're delighted to confirm order <strong>#${data.order_number}</strong> — our team is now carefully preparing each piece for dispatch. We'll email your tracking details the moment it ships.</p>

      <h3 style="margin:24px 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:2px;color:#999;">Order Summary</h3>
      ${itemsTable(data.items)}
      ${totalsBlock(data)}
      ${codBlock(data)}

      ${data.shipping_address ? `<p style="margin-top:24px;font-size:13px;color:#999;"><strong>Shipping to:</strong> ${data.shipping_address}</p>` : ""}

      <div style="text-align:center;margin-top:32px;">
        <a href="${trackOrderUrl(data)}" class="btn">Track Your Order</a>
      </div>
    `),
  }),

  "order.shipped": (data: OrderEmailData) => ({
    subject: `Your Order #${data.order_number} Has Been Shipped!`,
    html: baseLayout(`
      <h2>Your order is on its way!</h2>
      <p>Hi ${titleCase(data.customer_name)},</p>
      <p>Great news — your order <strong>#${data.order_number}</strong> has been shipped and is on its way to you.</p>

      ${data.tracking_number ? `
      <div style="background:#f5f5f7;padding:16px;border-radius:8px;margin:24px 0;text-align:center;">
        <span style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#999;">Tracking Number</span><br>
        <span style="font-size:18px;font-weight:600;margin-top:8px;display:inline-block;">${data.tracking_number}</span>
      </div>
      ` : ""}

      <h3 style="margin:24px 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:2px;color:#999;">Items Shipped</h3>
      ${itemsTable(data.items)}

      <div style="text-align:center;margin-top:32px;">
        <a href="${trackOrderUrl(data)}" class="btn">Track Your Order</a>
      </div>
    `),
  }),

  "order.delivered": (data: OrderEmailData) => ({
    subject: `Your Order #${data.order_number} Has Been Delivered`,
    html: baseLayout(`
      <h2>Your order has been delivered!</h2>
      <p>Hi ${titleCase(data.customer_name)},</p>
      <p>Your order <strong>#${data.order_number}</strong> has been delivered. We hope you love your new jewellery!</p>

      <h3 style="margin:24px 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:2px;color:#999;">What You Ordered</h3>
      ${itemsTable(data.items)}

      <p style="margin-top:24px;">If you have any questions or concerns about your order, please don't hesitate to contact us.</p>

      <div style="text-align:center;margin-top:32px;">
        <a href="${process.env.STOREFRONT_URL || 'http://localhost:8000'}/account/reviews" class="btn">Leave a Review</a>
      </div>
    `),
  }),

  "order.canceled": (data: OrderEmailData) => ({
    subject: `Order #${data.order_number} Has Been Cancelled`,
    html: baseLayout(`
      <h2>Your order has been cancelled</h2>
      <p>Hi ${titleCase(data.customer_name)},</p>
      <p>Your order <strong>#${data.order_number}</strong> has been cancelled. If a payment was made, a refund will be processed within 5-7 business days.</p>

      <h3 style="margin:24px 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:2px;color:#999;">Cancelled Items</h3>
      ${itemsTable(data.items)}

      <p style="margin-top:24px;">If you didn't request this cancellation or have questions, please contact our support team.</p>
    `),
  }),

  "review.request": (data: OrderEmailData) => ({
    subject: `How was your ${data.brand_name} experience? Leave a review!`,
    html: baseLayout(`
      <h2>We'd love your feedback!</h2>
      <p>Hi ${titleCase(data.customer_name)},</p>
      <p>It's been a few days since your order <strong>#${data.order_number}</strong> was delivered. We hope you're loving your new jewellery!</p>

      <p>Your opinion matters to us. Would you take a moment to share your experience?</p>

      <h3 style="margin:24px 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:2px;color:#999;">Your Order</h3>
      ${itemsTable(data.items)}

      <div style="text-align:center;margin-top:32px;">
        <a href="${process.env.STOREFRONT_URL || 'http://localhost:8000'}/account/reviews" class="btn">Write a Review</a>
      </div>

      <p style="margin-top:24px;font-size:13px;color:#999;">
        Your review helps other customers make informed decisions and helps us improve our products and service.
      </p>
    `),
  }),
}

// ─── Gift card delivery ──────────────────────────────────────
export interface GiftCardEmailData {
  recipient_email: string
  recipient_name?: string | null
  purchaser_name?: string | null
  code: string
  value: string // formatted, e.g. "₹1,000.00"
  expires_at?: string | null
  message?: string | null
  brand_name: string
}

// ─── RTO (Return-to-Origin) refund processed — customer ─────
export interface RtoRefundEmailData {
  customer_email: string
  customer_name: string
  order_number: number | string
  refund_amount: string | null // formatted, e.g. "₹3,499.00"; null if COD
  is_prepaid: boolean
  brand_name: string
}

export function rtoRefundProcessedTemplate(data: RtoRefundEmailData) {
  return {
    subject: `Order #${data.order_number} returned — refund update`,
    html: baseLayout(`
      <h2>We've received your returned order</h2>
      <p>Hi ${titleCase(data.customer_name)},</p>
      <p>Your order <strong>#${data.order_number}</strong> has arrived back at our warehouse.</p>
      ${
        data.is_prepaid && data.refund_amount
          ? `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#16a34a;margin:0 0 6px;">Refund initiated</p>
          <p style="font-size:24px;font-weight:bold;color:#15803d;margin:0;">${data.refund_amount}</p>
          <p style="font-size:13px;color:#166534;margin:10px 0 0;">Typically reaches your account in 3–5 business days, via your original payment method.</p>
        </div>
      `
          : `
        <div style="background:#fef9c3;border:1px solid #fde047;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
          <p style="font-size:13px;color:#854d0e;margin:0;">This was a Cash-on-Delivery order — no payment was collected, so there's nothing to refund.</p>
        </div>
      `
      }
      <p style="margin-top:24px;font-size:13px;color:#666;">If you have any questions, reply to this email and our team will help. We hope to see you back soon.</p>
    `),
  }
}

// ─── RTO refund processed — admin alert ─────────────────────
export interface RtoAdminEmailData {
  to: string
  order_number: number | string
  refund_amount: string | null
  refunded: boolean
  restocked: boolean
  items: Array<{ title: string; quantity: number }>
  brand_name: string
}

export function rtoProcessedAdminTemplate(data: RtoAdminEmailData) {
  return {
    subject: `[RTO] Order #${data.order_number} returned — restocked, please verify`,
    html: baseLayout(`
      <h2>Order #${data.order_number} has been returned</h2>
      <p>The parcel for order <strong>#${data.order_number}</strong> is back at the warehouse. The system has:</p>
      <ul style="font-size:14px;line-height:1.8;">
        <li>${data.restocked ? "✅ Restocked the items" : "⚠️ Restock failed — check logs"}</li>
        <li>${data.refunded ? `✅ Refunded ${data.refund_amount} via the original payment` : data.refund_amount === null ? "ℹ️ COD order — no refund needed" : "⚠️ Refund pending or failed — check logs"}</li>
      </ul>
      <h3 style="margin:24px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#999;">Items to verify</h3>
      <ul style="font-size:14px;line-height:1.8;">
        ${data.items.map((it) => `<li>${it.quantity} × ${it.title}</li>`).join("")}
      </ul>
      <p style="margin-top:24px;font-size:13px;color:#666;">Please inspect the items for condition before they go back on sale. If anything is damaged, mark the inventory accordingly in the admin dashboard.</p>
    `),
  }
}

// ─── Low-stock digest (admin) ────────────────────────────────
export interface LowStockEmailData {
  to: string
  threshold: number
  items: Array<{
    product_title: string
    variant_title: string
    sku: string | null
    available: number
    location: string
  }>
  brand_name: string
}

export function lowStockDigestTemplate(data: LowStockEmailData) {
  return {
    subject: `[Inventory] ${data.items.length} variant${data.items.length === 1 ? "" : "s"} low on stock`,
    html: baseLayout(`
      <h2>Low-stock alert</h2>
      <p>The following variants are at or below the threshold of <strong>${data.threshold}</strong> units available:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead>
          <tr style="border-bottom:2px solid #e5e5e5;text-align:left;">
            <th style="padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;">Product</th>
            <th style="padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;">Variant</th>
            <th style="padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;">SKU</th>
            <th style="padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;text-align:right;">Available</th>
          </tr>
        </thead>
        <tbody>
          ${data.items
            .map(
              (it) => `
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:10px 6px;font-size:13.5px;color:#5D2E46;">${it.product_title}</td>
              <td style="padding:10px 6px;font-size:13px;color:#666;">${it.variant_title}</td>
              <td style="padding:10px 6px;font-size:12px;color:#999;font-family:monospace;">${it.sku || "—"}</td>
              <td style="padding:10px 6px;font-size:14px;font-weight:bold;color:${
                it.available <= 0 ? "#dc2626" : "#d97706"
              };text-align:right;">${it.available}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
      <p style="font-size:13px;color:#666;margin-top:20px;">Restock these items in the admin dashboard to keep the storefront in stock.</p>
    `),
  }
}

// ─── Return-request lifecycle ────────────────────────────────
export interface ReturnEmailData {
  customer_email: string
  customer_name: string
  order_number: number | string
  request_id: string
  reason?: string | null
  rejected_reason?: string | null
  brand_name: string
}

export interface ReturnCompletedEmailData {
  customer_email: string
  customer_name: string
  order_number: number | string
  refund_amount: string | null
  is_prepaid: boolean
  brand_name: string
}

export interface ReturnAdminEmailData {
  to: string
  customer_email: string
  order_number: number | string
  request_id: string
  reason: string
  items: Array<{ title: string; quantity: number }>
  brand_name: string
}

export function returnSubmittedTemplate(data: ReturnEmailData) {
  return {
    subject: `Return request received — order #${data.order_number}`,
    html: baseLayout(`
      <h2>We've received your return request</h2>
      <p>Hi ${titleCase(data.customer_name)},</p>
      <p>We've got your request to return items from order <strong>#${data.order_number}</strong>. Our team will review it shortly and email you next steps.</p>
      <p style="font-size:13px;color:#666;margin-top:24px;">Reference: <code>${data.request_id.slice(-8).toUpperCase()}</code></p>
    `),
  }
}

export function returnApprovedTemplate(data: ReturnEmailData) {
  const supportEmail = process.env.SUPPORT_EMAIL || "enquire@delfee.in"
  return {
    subject: `Return approved — order #${data.order_number}`,
    html: baseLayout(`
      <h2>Your return has been approved</h2>
      <p>Hi ${titleCase(data.customer_name)},</p>
      <p>Your return request for order <strong>#${data.order_number}</strong> is approved.</p>
      <div style="background:#faf8f3;border:1px solid #ecdfd0;border-radius:12px;padding:20px;margin:20px 0;">
        <p style="font-weight:600;color:#5D2E46;margin:0 0 8px;">Send the items back to us:</p>
        <p style="font-size:13.5px;line-height:1.7;color:#5D2E46;margin:0;">
          Pack the items securely in the original box if possible.<br/>
          Email <a href="mailto:${supportEmail}">${supportEmail}</a> and we'll share the return address and pickup options.<br/>
          Mention <code>${data.request_id.slice(-8).toUpperCase()}</code> on the package.
        </p>
      </div>
      <p style="font-size:13px;color:#666;">Once we receive and inspect the items, your refund will be processed within 3 business days.</p>
    `),
  }
}

export function returnRejectedTemplate(data: ReturnEmailData) {
  return {
    subject: `Update on your return request — order #${data.order_number}`,
    html: baseLayout(`
      <h2>About your return request</h2>
      <p>Hi ${titleCase(data.customer_name)},</p>
      <p>Unfortunately we weren't able to approve your return for order <strong>#${data.order_number}</strong>.</p>
      ${
        data.rejected_reason
          ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin:16px 0;"><p style="color:#991b1b;margin:0;"><strong>Reason:</strong> ${data.rejected_reason}</p></div>`
          : ""
      }
      <p style="font-size:13px;color:#666;margin-top:20px;">If you have questions, just reply to this email and our team will help.</p>
    `),
  }
}

export function returnCompletedTemplate(data: ReturnCompletedEmailData) {
  return {
    subject: `Return complete — refund update for order #${data.order_number}`,
    html: baseLayout(`
      <h2>We've received your return</h2>
      <p>Hi ${titleCase(data.customer_name)},</p>
      <p>Your returned items for order <strong>#${data.order_number}</strong> are back with us. Thank you!</p>
      ${
        data.is_prepaid && data.refund_amount
          ? `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#16a34a;margin:0 0 6px;">Refund initiated</p>
          <p style="font-size:24px;font-weight:bold;color:#15803d;margin:0;">${data.refund_amount}</p>
          <p style="font-size:13px;color:#166534;margin:10px 0 0;">Typically reaches your account in 3–5 business days, via your original payment method.</p>
        </div>
      `
          : `
        <div style="background:#fef9c3;border:1px solid #fde047;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
          <p style="font-size:13px;color:#854d0e;margin:0;">This was a Cash-on-Delivery order — no payment was collected, so there's nothing to refund.</p>
        </div>
      `
      }
    `),
  }
}

// ─── Exchange lifecycle ──────────────────────────────────────
export interface ExchangeEmailData {
  customer_email: string
  customer_name: string
  order_number: number | string
  request_id: string
  items: Array<{ title: string; from_variant: string; to_variant: string; quantity: number }>
  brand_name: string
}

export interface ReplacementShippedEmailData {
  customer_email: string
  customer_name: string
  order_number: number | string
  replacement_order_number?: number | string | null
  tracking_url?: string | null
  brand_name: string
}

function exchangeItemsList(
  items: ExchangeEmailData["items"]
): string {
  if (!items?.length) return ""
  return `
    <h3 style="margin:24px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#999;">Exchange</h3>
    <ul style="font-size:14px;line-height:1.8;">
      ${items
        .map(
          (it) =>
            `<li>${it.quantity} × <strong>${it.title}</strong> — ${it.from_variant} → ${it.to_variant}</li>`
        )
        .join("")}
    </ul>
  `
}

export function exchangeSubmittedTemplate(data: ExchangeEmailData) {
  return {
    subject: `Exchange request received — order #${data.order_number}`,
    html: baseLayout(`
      <h2>We've received your exchange request</h2>
      <p>Hi ${titleCase(data.customer_name)},</p>
      <p>We've got your request to exchange items from order <strong>#${data.order_number}</strong>. Our team will review it shortly and email you next steps.</p>
      ${exchangeItemsList(data.items)}
      <p style="font-size:13px;color:#666;margin-top:24px;">Reference: <code>${data.request_id.slice(-8).toUpperCase()}</code></p>
    `),
  }
}

export function exchangeApprovedTemplate(data: ExchangeEmailData) {
  const supportEmail = process.env.SUPPORT_EMAIL || "enquire@delfee.in"
  return {
    subject: `Exchange approved — order #${data.order_number}`,
    html: baseLayout(`
      <h2>Your exchange has been approved</h2>
      <p>Hi ${titleCase(data.customer_name)},</p>
      <p>Your exchange request for order <strong>#${data.order_number}</strong> is approved.</p>
      ${exchangeItemsList(data.items)}
      <div style="background:#faf8f3;border:1px solid #ecdfd0;border-radius:12px;padding:20px;margin:20px 0;">
        <p style="font-weight:600;color:#5D2E46;margin:0 0 8px;">Send the items back to us:</p>
        <p style="font-size:13.5px;line-height:1.7;color:#5D2E46;margin:0;">
          Pack the items securely in the original box if possible.<br/>
          Email <a href="mailto:${supportEmail}">${supportEmail}</a> and we'll share the return address and pickup options.<br/>
          Mention <code>${data.request_id.slice(-8).toUpperCase()}</code> on the package.
        </p>
      </div>
      <p style="font-size:13px;color:#666;">Once we receive and inspect the items, we'll ship out your replacement.</p>
    `),
  }
}

export function replacementShippedTemplate(data: ReplacementShippedEmailData) {
  return {
    subject: `Your replacement is on the way — order #${data.order_number}`,
    html: baseLayout(`
      <h2>Your replacement is on its way</h2>
      <p>Hi ${titleCase(data.customer_name)},</p>
      <p>We've shipped your replacement for order <strong>#${data.order_number}</strong>.</p>
      ${
        data.replacement_order_number
          ? `<p>Replacement order: <strong>#${data.replacement_order_number}</strong></p>`
          : ""
      }
      ${
        data.tracking_url
          ? `<p style="margin-top:20px;"><a href="${data.tracking_url}" style="background:#5D2E46;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:13.5px;">Track your replacement</a></p>`
          : ""
      }
      <p style="font-size:13px;color:#666;margin-top:24px;">Thanks for your patience while we sorted this out.</p>
    `),
  }
}

// ─── Abandoned cart recovery ─────────────────────────────────
export interface AbandonedCartEmailData {
  customer_email: string
  customer_name: string
  cart_id: string
  recover_url: string
  items: Array<{
    title: string
    variant_title?: string | null
    quantity: number
    unit_price: string
    thumbnail?: string | null
  }>
  cart_total: string
  brand_name: string
}

export function abandonedCartRecoveryTemplate(data: AbandonedCartEmailData) {
  const itemRows = (data.items || [])
    .map(
      (it) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #f0eadf;vertical-align:top;">
          ${
            it.thumbnail
              ? `<img src="${it.thumbnail}" alt="" width="56" height="56" style="display:block;border-radius:8px;object-fit:cover;background:#faf8f3;" />`
              : `<div style="width:56px;height:56px;border-radius:8px;background:#faf8f3;"></div>`
          }
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #f0eadf;">
          <p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a;">${it.title}</p>
          ${
            it.variant_title
              ? `<p style="margin:2px 0 0;font-size:12px;color:#888;">${it.variant_title}</p>`
              : ""
          }
          <p style="margin:4px 0 0;font-size:12px;color:#666;">Qty: ${it.quantity}</p>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #f0eadf;text-align:right;font-size:13.5px;font-weight:600;color:#5D2E46;white-space:nowrap;">
          ${it.unit_price}
        </td>
      </tr>`
    )
    .join("")

  return {
    subject: `You left something in your cart — ${data.brand_name}`,
    html: baseLayout(`
      <h2>Your cart is waiting</h2>
      <p>Hi ${titleCase(data.customer_name)},</p>
      <p>You left these items in your cart. They're still available — come back when you're ready.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        ${itemRows}
        <tr>
          <td colspan="2" style="padding:14px 8px 0;font-size:13px;color:#666;">Total in cart</td>
          <td style="padding:14px 8px 0;text-align:right;font-size:16px;font-weight:700;color:#5D2E46;">${data.cart_total}</td>
        </tr>
      </table>
      <p style="text-align:center;margin:24px 0;">
        <a href="${data.recover_url}" class="btn" style="background:#5D2E46;color:#fff;">Take me back to my cart</a>
      </p>
      <p style="font-size:12px;color:#999;margin-top:24px;text-align:center;">
        If you've already completed your order, please ignore this email.
      </p>
    `),
  }
}

export function returnAdminAlertTemplate(data: ReturnAdminEmailData) {
  return {
    subject: `[Return] New request — order #${data.order_number}`,
    html: baseLayout(`
      <h2>New return request</h2>
      <p>Customer ${data.customer_email} submitted a return for order <strong>#${data.order_number}</strong>.</p>
      <p><strong>Reason:</strong> ${data.reason}</p>
      <h3 style="margin:24px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#999;">Items to return</h3>
      <ul style="font-size:14px;line-height:1.8;">
        ${data.items.map((it) => `<li>${it.quantity} × ${it.title}</li>`).join("")}
      </ul>
      <p style="font-size:13px;color:#666;margin-top:20px;">Reference: <code>${data.request_id.slice(-8).toUpperCase()}</code></p>
      <p style="font-size:13px;color:#666;">Approve or reject via the admin API: <code>POST /admin/return-requests/${data.request_id}/{approve,reject}</code></p>
    `),
  }
}

export interface ContactNotificationData {
  to: string
  name: string
  email: string
  phone?: string | null
  subject?: string | null
  message: string
}

export function contactNotificationTemplate(data: ContactNotificationData) {
  return {
    subject: `[Contact] ${data.subject || "New message"} — from ${data.name}`,
    html: baseLayout(`
      <h2>New contact message</h2>
      <p><strong>${data.name}</strong> sent a message through the Contact Us form.</p>
      <table style="font-size:14px;line-height:1.8;margin:16px 0;">
        <tr><td style="color:#999;padding-right:16px;">Email</td><td><a href="mailto:${data.email}">${data.email}</a></td></tr>
        ${data.phone ? `<tr><td style="color:#999;padding-right:16px;">Phone</td><td>${data.phone}</td></tr>` : ""}
        ${data.subject ? `<tr><td style="color:#999;padding-right:16px;">Subject</td><td>${data.subject}</td></tr>` : ""}
      </table>
      <h3 style="margin:24px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#999;">Message</h3>
      <p style="font-size:14px;white-space:pre-wrap;padding:14px 18px;border-left:3px solid #D4AF37;background:#faf8f3;color:#5D2E46;">${data.message}</p>
      <div style="text-align:center;margin-top:28px;">
        <a href="mailto:${data.email}?subject=Re: ${encodeURIComponent(data.subject || "Your message")}" class="btn">Reply to ${data.name}</a>
      </div>
      <p style="font-size:12px;color:#999;margin-top:20px;">Manage all submissions in the CMS → Forms → Submissions.</p>
    `),
  }
}

export function giftCardPurchasedTemplate(data: GiftCardEmailData) {
  return {
    subject: `You've received a ${data.brand_name} gift card`,
    html: baseLayout(`
      <h2>You've received a gift!</h2>
      <p>Hello ${data.recipient_name || "there"},</p>
      <p>${
        data.purchaser_name
          ? `<strong>${data.purchaser_name}</strong> has sent you a ${data.brand_name} gift card.`
          : `Someone has sent you a ${data.brand_name} gift card.`
      }</p>
      ${
        data.message
          ? `<p style="margin:16px 0;padding:14px 18px;border-left:3px solid #D4AF37;background:#faf8f3;font-style:italic;color:#5D2E46;">"${data.message}"</p>`
          : ""
      }
      <div style="background:#faf8f3;border:1px solid #ecdfd0;border-radius:12px;padding:28px;text-align:center;margin:24px 0;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#999;margin:0 0 12px;">Your gift card code</p>
        <p style="font-size:26px;font-family:'Courier New',monospace;letter-spacing:3px;font-weight:bold;margin:0;color:#5D2E46;">${data.code}</p>
        <p style="font-size:15px;margin:18px 0 0;color:#5D2E46;">Value: <strong>${data.value}</strong></p>
        ${
          data.expires_at
            ? `<p style="font-size:12px;color:#999;margin:8px 0 0;">Expires ${data.expires_at}</p>`
            : ""
        }
      </div>
      <p style="font-size:13px;color:#666;">Apply this code at checkout to redeem your gift card. It can be used across multiple orders until the balance is fully used.</p>
      <div style="text-align:center;margin-top:32px;">
        <a href="${process.env.STOREFRONT_URL || "http://localhost:8000"}/" class="btn">Start Shopping</a>
      </div>
    `),
  }
}
