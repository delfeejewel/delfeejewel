import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { GIFT_CARD_MODULE } from "../modules/gift_card"

const CODE = "TEST-CARD-2024"
const VALUE = 500

/**
 * Seeds a test gift card with a known code so you can verify the redeem
 * flow without going through the full purchase + email cycle.
 *
 * Run with: npx medusa exec ./src/scripts/seed-test-gift-card.ts
 */
export default async function seedTestGiftCard({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const giftCardModule: any = container.resolve(GIFT_CARD_MODULE)

  const existing = await giftCardModule.listGiftCards({ code: CODE })
  if (existing?.length) {
    logger.info(`Test gift card already exists: ${CODE}`)
    logger.info(`  balance: ${existing[0].balance}, status: ${existing[0].status}`)
    return
  }

  const gc = await giftCardModule.createGiftCards({
    code: CODE,
    value: VALUE,
    balance: VALUE,
    currency_code: "inr",
    status: "active",
    expires_at: new Date(Date.now() + 365 * 86400_000),
    recipient_email: "test@delfee.local",
    recipient_name: "Test Recipient",
  })
  const id = Array.isArray(gc) ? gc[0]?.id : (gc as any)?.id
  logger.info(`Created test gift card: ${CODE} (₹${VALUE}) — ${id}`)
}
