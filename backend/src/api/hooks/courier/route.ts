import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { GET as shiprocketGET, POST as shiprocketPOST } from "../shiprocket/route"

/**
 * Alias of the Shiprocket webhook at a keyword-safe path.
 *
 * Shiprocket's dashboard rejects any webhook URL containing the words
 * "shiprocket" / "kartrocket" / "sr" / "kr" ("please check your endpoint" on
 * save). Our canonical handler lives at /hooks/shiprocket, which trips that
 * filter — so register it here at /hooks/courier and point the dashboard at
 * https://api.delfee.in/hooks/courier instead. Same handlers, same token.
 */
export const GET = (req: MedusaRequest, res: MedusaResponse) =>
  shiprocketGET(req, res)

export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  shiprocketPOST(req, res)
