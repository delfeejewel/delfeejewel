import { MedusaService } from "@medusajs/framework/utils"

import { ReturnRequest, ReturnRequestItem } from "./models/return-request"

class ReturnRequestModuleService extends MedusaService({
  ReturnRequest,
  ReturnRequestItem,
}) {}

export default ReturnRequestModuleService
