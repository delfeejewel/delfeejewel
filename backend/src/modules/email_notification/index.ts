import { Module } from "@medusajs/framework/utils"
import EmailNotificationService from "./service"

export default Module("email_notification", {
  service: EmailNotificationService,
})
