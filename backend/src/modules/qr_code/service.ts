import { MedusaService } from "@medusajs/framework/utils"

import QrCode from "./models/qr-code"

class QrCodeModuleService extends MedusaService({ QrCode }) {}

export default QrCodeModuleService
