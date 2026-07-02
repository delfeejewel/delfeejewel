import { MedusaService } from "@medusajs/framework/utils"

import NewsletterSubscriber from "./models/newsletter-subscriber"
import Campaign from "./models/campaign"

class MarketingService extends MedusaService({
  NewsletterSubscriber,
  Campaign,
}) {}

export default MarketingService
