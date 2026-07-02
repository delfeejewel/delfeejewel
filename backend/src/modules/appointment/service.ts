import { MedusaService } from "@medusajs/framework/utils"

import Appointment from "./models/appointment"
import AppointmentSetting from "./models/appointment-setting"

class AppointmentService extends MedusaService({
  Appointment,
  AppointmentSetting,
}) {}

export default AppointmentService
