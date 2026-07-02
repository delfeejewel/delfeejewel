import { Module } from "@medusajs/framework/utils"

import AppointmentService from "./service"

export const APPOINTMENT_MODULE = "appointment"

export default Module(APPOINTMENT_MODULE, {
  service: AppointmentService,
})
