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
  // Same brand shell as transactional emails (templates.ts baseLayout):
  // plum #5D2E46 header, warm neutral background, Outfit/Wittgenstein fonts
  // with system fallbacks.
  return `
  <div style="background:#f4f1ed;padding:32px 16px;font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(45,30,50,0.06)">
      <div style="background:#5D2E46;padding:28px 24px;text-align:center">
        <span style="font-family:'Wittgenstein',Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:6px;text-transform:uppercase;color:#ffffff;font-weight:600">${BRAND}</span>
      </div>
      <div style="padding:30px 28px;color:#555;font-size:14px;line-height:1.65">
        ${args.bodyHtml}
      </div>
      <div style="padding:20px 24px;background:#faf8f5;border-top:1px solid #ece8e2;color:#8a8a8a;font-size:12px;line-height:1.6;text-align:center">
        <p style="margin:0 0 6px">You're receiving this because you subscribed or shopped with ${BRAND}.</p>
        <p style="margin:0 0 6px">${SENDER_ADDRESS}</p>
        <p style="margin:0">
          <a href="${args.unsubscribeUrl}" style="color:#5D2E46;text-decoration:underline">Unsubscribe</a>
          from marketing emails.
        </p>
      </div>
    </div>
  </div>`
}
