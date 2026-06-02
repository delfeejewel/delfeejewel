import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"

type ShiprocketOptions = {
  email: string
  password: string
  pickup_location?: string
  default_weight?: number // in kg, default 0.1 for jewellery
}

// Shiprocket API base
const API_BASE = "https://apiv2.shiprocket.in/v1/external"

export default class ShiprocketFulfillmentService extends AbstractFulfillmentProviderService {
  static identifier = "shiprocket"

  private options_: ShiprocketOptions
  private token_: string | null = null
  private tokenExpiry_: number = 0

  constructor(container: any, options: ShiprocketOptions) {
    super()
    this.options_ = options
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
    try {
      const address = context?.shipping_address
      if (!address?.postal_code) {
        // Return flat rate if no address yet
        return {
          calculated_amount: optionData.id === "shiprocket-express" ? 15000 : 8000, // ₹150 or ₹80
          is_calculated_price_tax_inclusive: true,
        }
      }

      // Get pickup pincode from options or default
      const pickupPincode = this.options_.pickup_location || "136118"
      const deliveryPincode = address.postal_code
      const weight = this.options_.default_weight || 0.1 // 100g for jewellery

      const result = await this.apiCall(
        `/courier/serviceability/?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&weight=${weight}&cod=0`
      )

      const couriers = result?.data?.available_courier_companies || []

      if (!couriers.length) {
        // Fallback flat rate
        return {
          calculated_amount: optionData.id === "shiprocket-express" ? 15000 : 8000,
          is_calculated_price_tax_inclusive: true,
        }
      }

      // Sort by rate — cheapest for standard, fastest for express
      if (optionData.id === "shiprocket-express") {
        couriers.sort((a: any, b: any) => a.estimated_delivery_days - b.estimated_delivery_days)
      } else {
        couriers.sort((a: any, b: any) => a.rate - b.rate)
      }

      const selected = couriers[0]
      return {
        calculated_amount: Math.round(selected.rate * 100), // Convert to paise
        is_calculated_price_tax_inclusive: true,
      }
    } catch (error) {
      // Fallback flat rate on error
      return {
        calculated_amount: optionData.id === "shiprocket-express" ? 15000 : 8000,
        is_calculated_price_tax_inclusive: true,
      }
    }
  }

  // ─── Create Fulfillment (Create Shipment) ────
  async createFulfillment(
    data: any,
    items: any[],
    order: any,
    fulfillment: any
  ): Promise<any> {
    const address = order?.shipping_address || {}
    const weight = this.options_.default_weight || 0.1

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
        hsn: item.metadata?.hsn_code || "7117",
      })),
      payment_method: "Prepaid",
      sub_total: (order?.total || 0) / 100,
      length: 10,
      breadth: 8,
      height: 5,
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
