import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { MARKETING_MODULE } from "../../../modules/marketing"
import { verifyUnsubscribeToken } from "../../../utils/unsubscribe-token"

const page = (title: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
   <body style="font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#faf9f7;margin:0">
     <div style="max-width:460px;margin:64px auto;padding:32px;background:#fff;border:1px solid #ece8e2;border-radius:14px;text-align:center;color:#1a1a1a">
       <h1 style="font-size:20px;margin:0 0 10px;font-family:'Wittgenstein',Georgia,'Times New Roman',serif;color:#5D2E46">${title}</h1>
       ${body}
     </div>
   </body></html>`

async function applyUnsubscribe(req: MedusaRequest, email: string) {
  const marketing: any = req.scope.resolve(MARKETING_MODULE)
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
    await marketing.createNewsletterSubscribers({
      email,
      status: "unsubscribed",
      source: "unsubscribe-link",
      unsubscribed_at: new Date(),
    })
  }
}

/**
 * GET /newsletter/unsubscribe?token=...
 * Renders a CONFIRM page — it must NOT mutate. Corporate link-scanners and
 * browser prefetchers issue GETs against every link in an email; a GET that
 * unsubscribed would silently opt people out. The actual unsubscribe happens on
 * the POST below (RFC 8058 one-click style), triggered by the confirm button.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const token = (req.query.token as string) || ""
  const payload = verifyUnsubscribeToken(token)

  res.setHeader("Content-Type", "text/html; charset=utf-8")
  if (!payload) {
    return res
      .status(400)
      .send(page("Link expired", `<p style="color:#666;font-size:14px;line-height:1.6;margin:0">This unsubscribe link is invalid or has expired.</p>`))
  }

  return res.send(
    page(
      "Unsubscribe?",
      `<p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 20px">Confirm you no longer want marketing emails from us. You'll still get order and account notifications.</p>
       <form method="POST" action="/newsletter/unsubscribe?token=${encodeURIComponent(token)}">
         <button type="submit" style="cursor:pointer;background:#5D2E46;color:#fff;border:0;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:600">Unsubscribe</button>
       </form>`
    )
  )
}

/**
 * POST /newsletter/unsubscribe  { token }
 * Performs the actual unsubscribe. Reached from the confirm button (or an
 * RFC 8058 List-Unsubscribe-Post one-click request).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as Record<string, any>
  const token = (body.token as string) || (req.query.token as string) || ""
  const payload = verifyUnsubscribeToken(token)

  res.setHeader("Content-Type", "text/html; charset=utf-8")
  if (!payload) {
    return res
      .status(400)
      .send(page("Link expired", `<p style="color:#666;font-size:14px;line-height:1.6;margin:0">This unsubscribe link is invalid or has expired.</p>`))
  }

  try {
    await applyUnsubscribe(req, payload.email)
    return res.send(
      page(
        "You're unsubscribed",
        `<p style="color:#666;font-size:14px;line-height:1.6;margin:0">You won't receive any more marketing emails from us. You'll still get order and account notifications.</p>`
      )
    )
  } catch {
    return res
      .status(500)
      .send(page("Something went wrong", `<p style="color:#666;font-size:14px;line-height:1.6;margin:0">Please try again in a moment.</p>`))
  }
}
