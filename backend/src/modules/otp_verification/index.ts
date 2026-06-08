import { Module } from "@medusajs/framework/utils"
import OtpVerificationService from "./service"

export const OTP_MODULE = "otp_verification"

export default Module(OTP_MODULE, {
  service: OtpVerificationService,
})
