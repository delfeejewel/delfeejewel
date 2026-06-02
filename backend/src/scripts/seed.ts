import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import { ApiKey } from "../../.medusa/types/query-entry-points";

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[];
    store_id: string;
  }) => {
    const normalizedInput = transform({ input }, (data) => {
      return {
        selector: { id: data.input.store_id },
        update: {
          supported_currencies: data.input.supported_currencies.map(
            (currency) => {
              return {
                currency_code: currency.currency_code,
                is_default: currency.is_default ?? false,
              };
            }
          ),
        },
      };
    });

    const stores = updateStoresStep(normalizedInput);

    return new WorkflowResponse(stores);
  }
);

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);

  logger.info("Seeding store data...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [
        {
          currency_code: "inr",
          is_default: true,
        },
      ],
    },
  });

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  });

  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "India",
          currency_code: "inr",
          countries: ["in"],
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  });
  const region = regionResult[0];
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: [
      {
        country_code: "in",
        provider_id: "tp_system",
      },
    ],
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Mumbai Warehouse",
          address: {
            city: "Mumbai",
            country_code: "IN",
            address_1: "",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_location_id: stockLocation.id,
      },
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  logger.info("Seeding fulfillment data...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [
            {
              name: "Default Shipping Profile",
              type: "default",
            },
          ],
        },
      });
    shippingProfile = shippingProfileResult[0];
  }

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "India Delivery",
    type: "shipping",
    service_zones: [
      {
        name: "India",
        geo_zones: [
          {
            country_code: "in",
            type: "country",
          },
        ],
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Delivered in 5-7 business days.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "inr",
            amount: 99,
          },
          {
            region_id: region.id,
            amount: 99,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Express Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Delivered in 1-2 business days.",
          code: "express",
        },
        prices: [
          {
            currency_code: "inr",
            amount: 299,
          },
          {
            region_id: region.id,
            amount: 299,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding publishable API key data...");
  let publishableApiKey: ApiKey | null = null;
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id"],
    filters: {
      type: "publishable",
    },
  });

  publishableApiKey = data?.[0];

  if (!publishableApiKey) {
    const {
      result: [publishableApiKeyResult],
    } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            title: "Webshop",
            type: "publishable",
            created_by: "",
          },
        ],
      },
    });

    publishableApiKey = publishableApiKeyResult as ApiKey;
  }

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding publishable API key data.");

  logger.info("Seeding jewellery product categories...");
  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Rings",
          is_active: true,
          handle: "rings",
        },
        {
          name: "Necklaces",
          is_active: true,
          handle: "necklaces",
        },
        {
          name: "Earrings",
          is_active: true,
          handle: "earrings",
        },
        {
          name: "Bracelets",
          is_active: true,
          handle: "bracelets",
        },
      ],
    },
  });

  logger.info("Seeding product data...");
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Gold Solitaire Ring",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Rings")!.id,
          ],
          description:
            "A timeless gold solitaire ring crafted in 18K yellow gold. Perfect for engagements, anniversaries, or everyday elegance.",
          handle: "gold-solitaire-ring",
          weight: 5,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Size",
              values: ["6", "7", "8", "9", "10"],
            },
          ],
          variants: [
            { title: "Size 6", sku: "RING-GOLD-SOL-6", options: { Size: "6" }, prices: [{ amount: 15999, currency_code: "inr" }] },
            { title: "Size 7", sku: "RING-GOLD-SOL-7", options: { Size: "7" }, prices: [{ amount: 15999, currency_code: "inr" }] },
            { title: "Size 8", sku: "RING-GOLD-SOL-8", options: { Size: "8" }, prices: [{ amount: 15999, currency_code: "inr" }] },
            { title: "Size 9", sku: "RING-GOLD-SOL-9", options: { Size: "9" }, prices: [{ amount: 15999, currency_code: "inr" }] },
            { title: "Size 10", sku: "RING-GOLD-SOL-10", options: { Size: "10" }, prices: [{ amount: 15999, currency_code: "inr" }] },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Silver Oxidised Ring",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Rings")!.id,
          ],
          description:
            "Handcrafted oxidised silver ring with intricate traditional motifs. A statement piece for everyday wear.",
          handle: "silver-oxidised-ring",
          weight: 4,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Size",
              values: ["6", "7", "8", "9", "10"],
            },
          ],
          variants: [
            { title: "Size 6", sku: "RING-SIL-OX-6", options: { Size: "6" }, prices: [{ amount: 2499, currency_code: "inr" }] },
            { title: "Size 7", sku: "RING-SIL-OX-7", options: { Size: "7" }, prices: [{ amount: 2499, currency_code: "inr" }] },
            { title: "Size 8", sku: "RING-SIL-OX-8", options: { Size: "8" }, prices: [{ amount: 2499, currency_code: "inr" }] },
            { title: "Size 9", sku: "RING-SIL-OX-9", options: { Size: "9" }, prices: [{ amount: 2499, currency_code: "inr" }] },
            { title: "Size 10", sku: "RING-SIL-OX-10", options: { Size: "10" }, prices: [{ amount: 2499, currency_code: "inr" }] },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Gold Mangalsutra Necklace",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Necklaces")!.id,
          ],
          description:
            "A classic 22K gold mangalsutra with black beads. Crafted with traditional design and modern finesse.",
          handle: "gold-mangalsutra-necklace",
          weight: 8,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Length",
              values: ["16 inch", "18 inch", "20 inch"],
            },
          ],
          variants: [
            { title: "16 inch", sku: "NECK-MANG-16", options: { Length: "16 inch" }, prices: [{ amount: 24999, currency_code: "inr" }] },
            { title: "18 inch", sku: "NECK-MANG-18", options: { Length: "18 inch" }, prices: [{ amount: 27999, currency_code: "inr" }] },
            { title: "20 inch", sku: "NECK-MANG-20", options: { Length: "20 inch" }, prices: [{ amount: 29999, currency_code: "inr" }] },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Silver Chain Necklace",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Necklaces")!.id,
          ],
          description:
            "Minimalist 925 sterling silver chain necklace. Lightweight, durable, and perfect for layering.",
          handle: "silver-chain-necklace",
          weight: 6,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Length",
              values: ["16 inch", "18 inch", "20 inch"],
            },
          ],
          variants: [
            { title: "16 inch", sku: "NECK-SIL-16", options: { Length: "16 inch" }, prices: [{ amount: 1999, currency_code: "inr" }] },
            { title: "18 inch", sku: "NECK-SIL-18", options: { Length: "18 inch" }, prices: [{ amount: 2199, currency_code: "inr" }] },
            { title: "20 inch", sku: "NECK-SIL-20", options: { Length: "20 inch" }, prices: [{ amount: 2499, currency_code: "inr" }] },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Gold Jhumka Earrings",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Earrings")!.id,
          ],
          description:
            "Traditional 22K gold jhumka earrings with a bell-shaped design. A staple for ethnic and festive occasions.",
          handle: "gold-jhumka-earrings",
          weight: 6,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Style",
              values: ["Small", "Medium", "Large"],
            },
          ],
          variants: [
            { title: "Small", sku: "EAR-JHUMKA-S", options: { Style: "Small" }, prices: [{ amount: 8999, currency_code: "inr" }] },
            { title: "Medium", sku: "EAR-JHUMKA-M", options: { Style: "Medium" }, prices: [{ amount: 11999, currency_code: "inr" }] },
            { title: "Large", sku: "EAR-JHUMKA-L", options: { Style: "Large" }, prices: [{ amount: 14999, currency_code: "inr" }] },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Silver Stud Earrings",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Earrings")!.id,
          ],
          description:
            "Elegant 925 sterling silver stud earrings with a simple yet sophisticated design. Suitable for everyday wear.",
          handle: "silver-stud-earrings",
          weight: 2,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Style",
              values: ["Round", "Square", "Heart"],
            },
          ],
          variants: [
            { title: "Round", sku: "EAR-STUD-RND", options: { Style: "Round" }, prices: [{ amount: 999, currency_code: "inr" }] },
            { title: "Square", sku: "EAR-STUD-SQR", options: { Style: "Square" }, prices: [{ amount: 999, currency_code: "inr" }] },
            { title: "Heart", sku: "EAR-STUD-HRT", options: { Style: "Heart" }, prices: [{ amount: 1199, currency_code: "inr" }] },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Gold Kada Bracelet",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Bracelets")!.id,
          ],
          description:
            "Traditional 22K gold kada bracelet with intricate engravings. A bold statement piece for festive occasions.",
          handle: "gold-kada-bracelet",
          weight: 15,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Size",
              values: ["Small", "Medium", "Large"],
            },
          ],
          variants: [
            { title: "Small", sku: "BRAC-KADA-S", options: { Size: "Small" }, prices: [{ amount: 34999, currency_code: "inr" }] },
            { title: "Medium", sku: "BRAC-KADA-M", options: { Size: "Medium" }, prices: [{ amount: 39999, currency_code: "inr" }] },
            { title: "Large", sku: "BRAC-KADA-L", options: { Size: "Large" }, prices: [{ amount: 44999, currency_code: "inr" }] },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Silver Chain Bracelet",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Bracelets")!.id,
          ],
          description:
            "Delicate 925 sterling silver chain bracelet. Minimalist design perfect for everyday styling and gifting.",
          handle: "silver-chain-bracelet",
          weight: 5,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Size",
              values: ["6 inch", "7 inch", "8 inch"],
            },
          ],
          variants: [
            { title: "6 inch", sku: "BRAC-SIL-6", options: { Size: "6 inch" }, prices: [{ amount: 1499, currency_code: "inr" }] },
            { title: "7 inch", sku: "BRAC-SIL-7", options: { Size: "7 inch" }, prices: [{ amount: 1499, currency_code: "inr" }] },
            { title: "8 inch", sku: "BRAC-SIL-8", options: { Size: "8 inch" }, prices: [{ amount: 1699, currency_code: "inr" }] },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });
  logger.info("Finished seeding product data.");

  logger.info("Seeding inventory levels.");
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  const inventoryLevels: CreateInventoryLevelInput[] = [];
  for (const inventoryItem of inventoryItems) {
    inventoryLevels.push({
      location_id: stockLocation.id,
      stocked_quantity: 1000000,
      inventory_item_id: inventoryItem.id,
    });
  }

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryLevels,
    },
  });

  logger.info("Finished seeding inventory levels data.");
}
