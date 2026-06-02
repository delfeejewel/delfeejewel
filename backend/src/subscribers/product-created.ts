import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ISalesChannelModuleService } from "@medusajs/framework/types"

/**
 * On product creation:
 * 1. Auto-assigns the default sales channel
 * 2. Auto-assigns the default shipping profile
 *
 * Inventory management is handled by the variant-created subscriber.
 */
export default async function productCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  const productId = data.id

  // 1. Auto-assign default sales channel
  try {
    const salesChannelModule: ISalesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
    const [defaultChannel] = await salesChannelModule.listSalesChannels({}, { take: 1 })
    if (defaultChannel) {
      await remoteLink.create([
        {
          [Modules.PRODUCT]: { product_id: productId },
          [Modules.SALES_CHANNEL]: { sales_channel_id: defaultChannel.id },
        },
      ] as any)
      logger.info(`Auto-assigned product ${productId} to sales channel "${defaultChannel.name}"`)
    }
  } catch (error: any) {
    if (!error.message?.includes("already exists") && !error.message?.includes("duplicate")) {
      logger.warn(`Auto-assign sales channel failed: ${error.message}`)
    }
  }

  // 2. Auto-assign default shipping profile
  try {
    const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
    const [defaultProfile] = await fulfillmentModule.listShippingProfiles({}, { take: 1 })
    if (defaultProfile) {
      await remoteLink.create([
        {
          [Modules.PRODUCT]: { product_id: productId },
          [Modules.FULFILLMENT]: { shipping_profile_id: defaultProfile.id },
        },
      ] as any)
      logger.info(`Auto-assigned product ${productId} to shipping profile "${defaultProfile.name}"`)
    }
  } catch (error: any) {
    if (!error.message?.includes("already exists") && !error.message?.includes("duplicate")) {
      logger.warn(`Auto-assign shipping profile failed: ${error.message}`)
    }
  }
}

export const config: SubscriberConfig = {
  event: "product.created",
}
