import { Module } from "@medusajs/framework/utils"

import GiftCardModuleService from "./service"

export const GIFT_CARD_MODULE = "gift_card"

export default Module(GIFT_CARD_MODULE, {
  service: GiftCardModuleService,
})
