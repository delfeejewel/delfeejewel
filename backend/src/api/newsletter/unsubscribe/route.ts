import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { MARKETING_MODULE } from "../../../modules/marketing"
import { verifyUnsubscribeToken } from "../../../utils/unsubscribe-token"

/**
 * GET /newsletter/unsubscribe?token=...
 * One-click unsubscribe target for the link in every marketing email. Lives at
 * a top-level path (not /store) so the plain email-link navigation needs no
 * publishable key. Verifies the signed token, flips the subscriber to
 * unsubscribed (creating a suppression row if they were only ever a customer),
 * and returns a small confirmation page.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const token = (req.query.token as string) || ""
  const payload = verifyUnsubscribeToken(token)

  const page = (title: string, msg: string) =>
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
     <body style="font-family:system-ui,Arial,sans-serif;background:#faf9f7;margin:0">
       <div style="max-width:460px;margin:64px auto;padding:32px;background:#fff;border:1px solid #eee;border-radius:14px;text-align:center;color:#1a1a1a">
         <h1 style="font-size:20px;margin:0 0 10px">${title}</h1>
         <p style="color:#666;font-size:14px;line-height:1.6;margin:0">${msg}</p>
       </div>
     </body></html>`

  res.setHeader("Content-Type", "text/html; charset=utf-8")

  if (!payload) {
    return res
      .status(400)
      .send(page("Link expired", "This unsubscribe link is invalid or has expired."))
  }

  try {
    const marketing: any = req.scope.resolve(MARKETING_MODULE)
    const email = payload.email
    const existing = await marketing.listNewsletterSubscribers({ email })
    const row = existing?.[0]

    if (row) {
      if (row.status !== "unsubscribed") {
        await marketing.updateNewsletterSubscribers({
          id: row.id,
          status: "unsubscribed",
          unsubscribed_at: new Date(),
        })
      }
    } else {
      // Customer who was never a newsletter row — record a suppression entry so
      // future segment/customer sends skip them.
      await marketing.createNewsletterSubscribers({
        email,
        status: "unsubscribed",
        source: "unsubscribe-link",
        unsubscribed_at: new Date(),
      })
    }

    return res.send(
      page(
        "You're unsubscribed",
        "You won't receive any more marketing emails from us. You'll still get order and account notifications."
      )
    )
  } catch {
    return res
      .status(500)
      .send(page("Something went wrong", "Please try again in a moment."))
  }
}
