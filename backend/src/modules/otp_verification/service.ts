import { MedusaService } from "@medusajs/framework/utils"
import OtpCode from "./models/otp-code"

class OtpVerificationService extends MedusaService({
  OtpCode,
}) {}

export default OtpVerificationService
