import { HttpTypes } from "@medusajs/types"
import Input from "@modules/common/components/input"
import React, { useState } from "react"

const toLocalPhone = (v?: string | null) =>
  String(v || "").replace(/\D/g, "").slice(-10)

const BillingAddress = ({ cart }: { cart: HttpTypes.StoreCart | null }) => {
  const [formData, setFormData] = useState<any>({
    "billing_address.first_name": cart?.billing_address?.first_name || "",
    "billing_address.last_name": cart?.billing_address?.last_name || "",
    "billing_address.address_1": cart?.billing_address?.address_1 || "",
    "billing_address.address_2": cart?.billing_address?.address_2 || "",
    "billing_address.postal_code": cart?.billing_address?.postal_code || "",
    "billing_address.city": cart?.billing_address?.city || "",
    "billing_address.country_code":
      cart?.billing_address?.country_code ||
      cart?.region?.countries?.[0]?.iso_2 ||
      "in",
    "billing_address.province": cart?.billing_address?.province || "",
    "billing_address.phone": toLocalPhone(cart?.billing_address?.phone),
  })

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLInputElement | HTMLSelectElement
    >
  ) => {
    const { name } = e.target
    let value = e.target.value

    if (name === "billing_address.phone") {
      value = value.replace(/\D/g, "").slice(0, 10)
    }
    if (name === "billing_address.postal_code") {
      value = value.replace(/\D/g, "").slice(0, 6)
    }

    setFormData({
      ...formData,
      [name]: value,
    })
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="First name"
          name="billing_address.first_name"
          autoComplete="given-name"
          value={formData["billing_address.first_name"]}
          onChange={handleChange}
          required
          data-testid="billing-first-name-input"
        />
        <Input
          label="Last name"
          name="billing_address.last_name"
          autoComplete="family-name"
          value={formData["billing_address.last_name"]}
          onChange={handleChange}
          required
          data-testid="billing-last-name-input"
        />
        <Input
          label="Address line 1"
          name="billing_address.address_1"
          autoComplete="address-line1"
          value={formData["billing_address.address_1"]}
          onChange={handleChange}
          required
          className="col-span-2"
          data-testid="billing-address-input"
        />
        <Input
          label="Address line 2 (optional)"
          name="billing_address.address_2"
          autoComplete="address-line2"
          value={formData["billing_address.address_2"]}
          onChange={handleChange}
          className="col-span-2"
          data-testid="billing-address-2-input"
        />
        <Input
          label="Postal code"
          name="billing_address.postal_code"
          autoComplete="postal-code"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          title="Enter a valid 6-digit PIN code."
          value={formData["billing_address.postal_code"]}
          onChange={handleChange}
          required
          data-testid="billing-postal-input"
        />
        <Input
          label="City"
          name="billing_address.city"
          autoComplete="address-level2"
          value={formData["billing_address.city"]}
          onChange={handleChange}
          required
        />
        <Input
          label="State"
          name="billing_address.province"
          autoComplete="address-level1"
          value={formData["billing_address.province"]}
          onChange={handleChange}
          required
          className="col-span-2"
          data-testid="billing-province-input"
        />
        {/* Country is fixed to India — submitted as a hidden field. */}
        <input
          type="hidden"
          name="billing_address.country_code"
          value={formData["billing_address.country_code"]}
        />
        <Input
          label="Phone"
          name="billing_address.phone"
          type="tel"
          prefix="+91"
          autoComplete="tel-national"
          inputMode="numeric"
          pattern="\d{10}"
          maxLength={10}
          title="Enter a valid 10-digit mobile number."
          value={formData["billing_address.phone"]}
          onChange={handleChange}
          required
          data-testid="billing-phone-input"
        />
      </div>
    </>
  )
}

export default BillingAddress
