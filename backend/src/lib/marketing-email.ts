/**
 * Wraps a campaign's authored body HTML in a branded shell with the
 * legally-required marketing footer: sender identity + a one-click unsubscribe
 * link. Every marketing send goes through this so compliance can't be skipped.
 */

const BRAND = process.env.BRAND_NAME || "Delfee"
// Physical sender identity for the footer (CAN-SPAM / India DPDP good practice).
const SENDER_ADDRESS =
  process.env.MARKETING_SENDER_ADDRESS || `${BRAND}, India`

export function wrapMarketingHtml(args: {
  bodyHtml: string
  unsubscribeUrl: string
}): string {
  return `
  <div style="font-family:system-ui,-apple-system,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;color:#1a1a1a">
    <div style="padding:20px 24px;border-bottom:1px solid #eee">
      <span style="font-size:18px;font-weight:700;letter-spacing:.04em">${BRAND}</span>
    </div>
    <div style="padding:24px">
      ${args.bodyHtml}
    </div>
    <div style="padding:20px 24px;border-top:1px solid #eee;color:#8a8a8a;font-size:12px;line-height:1.6">
      <p style="margin:0 0 6px">You're receiving this because you subscribed or shopped with ${BRAND}.</p>
      <p style="margin:0 0 6px">${SENDER_ADDRESS}</p>
      <p style="margin:0">
        <a href="${args.unsubscribeUrl}" style="color:#8a8a8a;text-decoration:underline">Unsubscribe</a>
        from marketing emails.
      </p>
    </div>
  </div>`
}
