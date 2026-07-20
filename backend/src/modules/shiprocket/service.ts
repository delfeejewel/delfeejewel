import {
  AbstractFulfillmentProviderService,
  ContainerRegistrationKeys,
} from "@medusajs/framework/utils"

type ShiprocketOptions = {
  email: string
  password: string
  /** Shiprocket pickup address *nickname*, as configured under
   *  Settings → Company → Pickup Addresses. Not a pincode. */
  pickup_location?: string
  /** Pincode of that pickup address — used for courier serviceability/rate
   *  lookups, which need an actual postcode. */
  pickup_pincode?: string
  /** Fallback per-parcel weight in kg when no item carries a weight. */
  default_weight?: number // in kg, default 0.1 for jewellery
  /** Unit that variant `weight` values are recorded in. Medusa stores weight as
   *  a bare number with no unit, so this is what tells us how to read it.
   *  Jewellery is catalogued in grams, so "g" is the default — setting this
   *  wrong mis-declares every parcel by 1000x. */
  weight_unit?: "g" | "kg"
  /** Packaging weight (kg) added on top of the summed item weight — box, pouch,
   *  filler. Shiprocket bills on the declared weight, and an under-declared
   *  parcel gets reweighed and surcharged by the courier. */
  packaging_weight?: number
  /** Fallback parcel dimensions in cm, used when no per-order override exists. */
  default_dimensions?: { length: number; breadth: number; height: number }
  /** HSN code for shipments when an item carries none. 7113 = articles of
   *  jewellery of precious metal (925 sterling silver). */
  default_hsn?: string
  /** Free-shipping rule (Standard option only): the customer pays ₹0 when the
   *  item subtotal (pre-discount) is ABOVE this AND the live courier cost is
   *  BELOW `free_ship_max_courier`. Both in rupees. Defaults: 5000 / 400. */
  free_ship_min_subtotal?: number
  free_ship_max_courier?: number
}

// Shiprocket API base
const API_BASE = "https://apiv2.shiprocket.in/v1/external"

/** Shiprocket rejects a shipment with zero/absent weight or dimensions. */
const MIN_WEIGHT_KG = 0.05
const FALLBACK_DIMENSIONS = { length: 10, breadth: 8, height: 5 }

/** A COD/manual payment provider carries no online prepayment (mirrors the
 *  detection in lib/fraud-context.ts). Anything else (e.g. Razorpay) is
 *  treated as prepaid. */
function isCodProvider(providerId?: string | null): boolean {
  const id = (providerId || "").toLowerCase()
  return id.includes("cod") || id.includes("manual") || id.includes("system")
}

export default class ShiprocketFulfillmentService extends AbstractFulfillmentProviderService {
  static identifier = "shiprocket"

  private container_: any
  private options_: ShiprocketOptions
  private token_: string | null = null
  private tokenExpiry_: number = 0

  constructor(container: any, options: ShiprocketOptions) {
    super()
    this.container_ = container
    this.options_ = options
  }

  /**
   * Resolve the payment mode for an order: whether it is Cash-on-Delivery and,
   * for the store's COD-with-upfront-token flow, how much was already prepaid
   * (in major units / ₹). The courier must collect only the balance.
   */
  private async resolvePayment(
    orderId: string
  ): Promise<{ isCod: boolean; upfrontPaid: number }> {
    try {
      const query = this.container_.resolve(ContainerRegistrationKeys.QUERY)
      const {
        data: [full],
      } = await query.graph({
        entity: "order",
        fields: [
          "metadata",
          "payment_collections.payments.provider_id",
          "payment_collections.payment_sessions.provider_id",
          "cart.metadata",
        ],
        filters: { id: orderId },
      })
      const providerIds: string[] = (full?.payment_collections || []).flatMap(
        (pc: any) => [
          ...((pc.payments || []).map((p: any) => p.provider_id)),
          ...((pc.payment_sessions || []).map((s: any) => s.provider_id)),
        ]
      )
      const isCod = providerIds.some(isCodProvider)
      const upfrontPaid =
        Number((full?.metadata as any)?.cod_upfront_amount) ||
        Number((full?.cart?.metadata as any)?.cod_upfront_amount) ||
        0
      return { isCod, upfrontPaid }
    } catch {
      // If payment info can't be resolved, fall back to Prepaid — safe, since
      // it collects no cash rather than risking a wrong COD amount.
      return { isCod: false, upfrontPaid: 0 }
    }
  }

  // ─── Auth ────────────────────────────────────
  private async getToken(): Promise<string> {
    // Return cached token if still valid (24h validity)
    if (this.token_ && Date.now() < this.tokenExpiry_) {
      return this.token_
    }

    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: this.options_.email,
        password: this.options_.password,
      }),
    })

    if (!res.ok) {
      throw new Error(`Shiprocket auth failed: ${res.status}`)
    }

    const data = await res.json()
    this.token_ = data.token
    this.tokenExpiry_ = Date.now() + 23 * 60 * 60 * 1000 // 23 hours
    return this.token_!
  }

  private async apiCall(
    endpoint: string,
    method: string = "GET",
    body?: any
  ): Promise<any> {
    const token = await this.getToken()

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Shiprocket API ${endpoint} failed: ${res.status} - ${text}`)
    }

    return res.json()
  }

  // ─── Fulfillment Options ─────────────────────
  async getFulfillmentOptions(): Promise<any[]> {
    return [
      {
        id: "shiprocket-standard",
        name: "Standard Shipping",
        is_return: false,
      },
      {
        id: "shiprocket-express",
        name: "Express Shipping",
        is_return: false,
      },
      {
        id: "shiprocket-return",
        name: "Return Pickup",
        is_return: true,
      },
    ]
  }

  async validateOption(data: any): Promise<boolean> {
    return ["shiprocket-standard", "shiprocket-express", "shiprocket-return"].includes(data.id)
  }

  async validateFulfillmentData(
    optionData: any,
    data: any,
    context: any
  ): Promise<any> {
    return {
      ...data,
      ...optionData,
    }
  }

  // ─── Price Calculation ───────────────────────
  async canCalculate(data: any): Promise<boolean> {
    return true
  }

  async calculatePrice(
    optionData: any,
    data: any,
    context: any
  ): Promise<any> {
    // IMPORTANT: this store keeps prices in RUPEES (major unit) — a ₹1999 ring
    // is stored as 1999, and the flat shipping options are 99 / 299. So every
    // amount returned here is in rupees (NOT paise).
    const isExpress =
      optionData?.id === "shiprocket-express" || data?.id === "shiprocket-express"
    const FALLBACK = isExpress ? 299 : 99 // rupees, if Shiprocket can't be reached

    // Client free-shipping rule (Standard only): free to the customer when the
    // item subtotal (pre-discount) is above ₹5,000 AND the real courier cost is
    // under ₹400 — the client absorbs that courier cost in margin.
    const FREE_MIN_SUBTOTAL = Number(this.options_.free_ship_min_subtotal ?? 5000)
    const FREE_MAX_COURIER = Number(this.options_.free_ship_max_courier ?? 400)

    try {
      const address = context?.shipping_address
      const items: any[] = context?.items || []
      const itemSubtotal = items.reduce(
        (sum, it) =>
          sum + (Number(it?.unit_price) || 0) * (Number(it?.quantity) || 0),
        0
      )

      if (!address?.postal_code) {
        // No address yet — quote the flat fallback so the option still shows.
        return { calculated_amount: FALLBACK, is_calculated_price_tax_inclusive: true }
      }

      const pickupPincode = this.options_.pickup_pincode || "136118"
      const deliveryPincode = address.postal_code
      const weight = this.parcelWeightKg(items) || this.options_.default_weight || 0.3

      const result = await this.apiCall(
        `/courier/serviceability/?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&weight=${weight}&cod=0`
      )
      const couriers = result?.data?.available_courier_companies || []
      if (!couriers.length) {
        return { calculated_amount: FALLBACK, is_calculated_price_tax_inclusive: true }
      }

      // Standard = cheapest courier; Express = fastest courier.
      if (isExpress) {
        couriers.sort(
          (a: any, b: any) =>
            (a.estimated_delivery_days || 99) - (b.estimated_delivery_days || 99)
        )
      } else {
        couriers.sort((a: any, b: any) => (a.rate || 0) - (b.rate || 0))
      }

      const selected = couriers[0]
      const courierCost = Math.round(Number(selected?.rate) || FALLBACK) // rupees

      // Apply the free-shipping rule (Standard only).
      if (
        !isExpress &&
        itemSubtotal > FREE_MIN_SUBTOTAL &&
        courierCost < FREE_MAX_COURIER
      ) {
        return { calculated_amount: 0, is_calculated_price_tax_inclusive: true }
      }

      // Otherwise the customer pays the live courier cost.
      return { calculated_amount: courierCost, is_calculated_price_tax_inclusive: true }
    } catch (error) {
      return { calculated_amount: FALLBACK, is_calculated_price_tax_inclusive: true }
    }
  }

  /**
   * Per-unit weight of a fulfillment item, in kg.
   *
   * Depending on how the fulfillment was built, the weight may hang off the
   * variant, the line item, or the product — so check each in turn rather than
   * assuming a shape. Returns null when nothing carries a weight, which is the
   * signal to fall back to the configured default.
   */
  private itemWeightKg(item: any): number | null {
    const raw =
      item?.variant?.weight ??
      item?.line_item?.variant?.weight ??
      item?.product?.weight ??
      item?.weight

    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return null

    return (this.options_.weight_unit ?? "g") === "kg" ? n : n / 1000
  }

  /**
   * Declared parcel weight (kg): summed item weights + packaging.
   *
   * Falls back to default_weight if NO item carries a weight — but if only some
   * do, the known ones are summed and the rest are charged the default each, so
   * a half-populated catalogue still declares something sane.
   */
  private parcelWeightKg(items: any[]): number {
    const fallbackPerUnit = this.options_.default_weight || 0.1

    const total = (items ?? []).reduce((sum, item) => {
      const perUnit = this.itemWeightKg(item) ?? fallbackPerUnit
      return sum + perUnit * (item?.quantity || 1)
    }, 0)

    const withPackaging = total + (this.options_.packaging_weight || 0)
    return Math.max(MIN_WEIGHT_KG, Number(withPackaging.toFixed(3)))
  }

  /** Declared parcel dimensions (cm). An admin can override per order via
   *  order.metadata.parcel_dimensions when something doesn't fit the usual box. */
  private parcelDimensions(order: any): {
    length: number
    breadth: number
    height: number
  } {
    const override = order?.metadata?.parcel_dimensions
    const candidate = override ?? this.options_.default_dimensions

    const l = Number(candidate?.length)
    const b = Number(candidate?.breadth)
    const h = Number(candidate?.height)

    const valid = [l, b, h].every((n) => Number.isFinite(n) && n > 0)
    return valid
      ? { length: l, breadth: b, height: h }
      : { ...FALLBACK_DIMENSIONS }
  }

  // ─── Create Fulfillment (Create Shipment) ────
  async createFulfillment(
    data: any,
    items: any[],
    order: any,
    fulfillment: any
  ): Promise<any> {
    const logger = this.container_?.resolve?.(ContainerRegistrationKeys.LOGGER)
    const address = order?.shipping_address || {}
    const weight = this.parcelWeightKg(items)
    const { length, breadth, height } = this.parcelDimensions(order)
    const defaultHsn = this.options_.default_hsn || "7113"

    logger?.info(
      `Shiprocket: declaring order #${order?.display_id} as ${weight}kg, ` +
        `${length}x${breadth}x${height}cm`
    )

    // Payment mode drives whether the courier collects cash on delivery, and
    // (for the COD-with-upfront-token flow) how much: total minus the token
    // already prepaid online. A prepaid order collects nothing.
    const { isCod, upfrontPaid } = await this.resolvePayment(order?.id)
    const orderTotalMajor = (order?.total || 0) / 100
    const codCollectable = Math.max(0, orderTotalMajor - upfrontPaid)

    // Create order in Shiprocket
    const shiprocketOrder = await this.apiCall("/orders/create/adhoc", "POST", {
      order_id: order?.display_id?.toString() || fulfillment.id,
      order_date: new Date().toISOString().split("T")[0],
      pickup_location: this.options_.pickup_location || "Primary",
      billing_customer_name: address.first_name || "Customer",
      billing_last_name: address.last_name || "",
      billing_address: address.address_1 || "",
      billing_address_2: address.address_2 || "",
      billing_city: address.city || "",
      billing_pincode: address.postal_code || "",
      billing_state: address.province || address.state || "",
      billing_country: address.country_code?.toUpperCase() || "IN",
      billing_email: order?.email || "",
      billing_phone: address.phone || "",
      shipping_is_billing: true,
      order_items: items.map((item) => ({
        name: item.title || "Product",
        sku: item.sku || item.id,
        units: item.quantity || 1,
        selling_price: (item.unit_price || 0) / 100,
        discount: 0,
        tax: 0,
        hsn: item.metadata?.hsn_code || defaultHsn,
      })),
      payment_method: isCod ? "COD" : "Prepaid",
      // For COD, sub_total is the amount the courier collects on delivery —
      // the balance after any upfront token. For prepaid it's the order value.
      sub_total: isCod ? codCollectable : orderTotalMajor,
      length,
      breadth,
      height,
      weight,
    })

    // Generate AWB (Air Waybill)
    let awbData: any = {}
    if (shiprocketOrder?.order_id && shiprocketOrder?.shipment_id) {
      try {
        awbData = await this.apiCall("/courier/assign/awb", "POST", {
          shipment_id: shiprocketOrder.shipment_id,
        })
      } catch {
        // AWB generation might fail if no courier is auto-assigned
      }
    }

    return {
      data: {
        shiprocket_order_id: shiprocketOrder?.order_id,
        shiprocket_shipment_id: shiprocketOrder?.shipment_id,
        awb_code: awbData?.response?.data?.awb_code || null,
        courier_name: awbData?.response?.data?.courier_name || null,
      },
      labels: awbData?.response?.data?.awb_code
        ? [
            {
              tracking_number: awbData.response.data.awb_code,
              tracking_url: `https://www.shiprocket.in/tracking/${awbData.response.data.awb_code}`,
              label_url: "",
            },
          ]
        : [],
    }
  }

  // ─── Cancel Fulfillment ──────────────────────
  async cancelFulfillment(data: any): Promise<any> {
    if (data?.shiprocket_order_id) {
      try {
        await this.apiCall("/orders/cancel", "POST", {
          ids: [data.shiprocket_order_id],
        })
      } catch {
        // Ignore cancel errors
      }
    }
    return {}
  }

  // ─── Return Fulfillment ──────────────────────
  async createReturnFulfillment(fulfillment: any): Promise<any> {
    const data = fulfillment?.data || {}

    if (data.shiprocket_order_id) {
      try {
        const returnOrder = await this.apiCall("/orders/create/return", "POST", {
          order_id: data.shiprocket_order_id,
          order_date: new Date().toISOString().split("T")[0],
        })

        return {
          data: {
            shiprocket_return_id: returnOrder?.order_id,
            ...data,
          },
          labels: [],
        }
      } catch {
        // Fallback
      }
    }

    return { data, labels: [] }
  }

  // ─── Documents ───────────────────────────────
  async getFulfillmentDocuments(data: any): Promise<any> {
    if (data?.shiprocket_shipment_id) {
      try {
        const label = await this.apiCall(
          `/courier/generate/label`,
          "POST",
          { shipment_id: [data.shiprocket_shipment_id] }
        )
        return { label_url: label?.label_url }
      } catch {
        return {}
      }
    }
    return {}
  }

  async getReturnDocuments(data: any): Promise<any> {
    return {}
  }

  async getShipmentDocuments(data: any): Promise<any> {
    return this.getFulfillmentDocuments(data)
  }

  async retrieveDocuments(
    fulfillmentData: any,
    documentType: string
  ): Promise<any> {
    if (documentType === "label") {
      return this.getFulfillmentDocuments(fulfillmentData)
    }
    if (documentType === "invoice" && fulfillmentData?.shiprocket_shipment_id) {
      try {
        const invoice = await this.apiCall(
          `/orders/print/invoice`,
          "POST",
          { ids: [fulfillmentData.shiprocket_order_id] }
        )
        return { invoice_url: invoice?.invoice_url }
      } catch {
        return {}
      }
    }
    return {}
  }
}
