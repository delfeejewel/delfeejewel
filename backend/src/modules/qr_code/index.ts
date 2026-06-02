import { Module } from "@medusajs/framework/utils"

import QrCodeModuleService from "./service"

export const QR_CODE_MODULE = "qr_code"

export default Module(QR_CODE_MODULE, {
  service: QrCodeModuleService,
})
