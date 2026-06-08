import { HttpTypes } from "@medusajs/types"
import { Container } from "@medusajs/ui"
import Checkbox from "@modules/common/components/checkbox"
import Input from "@modules/common/components/input"
import { mapKeys } from "lodash"
import React, { useEffect, useMemo, useState } from "react"
import AddressSelect from "../address-select"
import { lookupIndianPincode } from "@lib/data/pincode"

// Strip any stored country code / formatting down to the local 10-digit number
// for display (the +91 prefix is shown as a static adornment, added back on submit).
const toLocalPhone = (v?: string | null) =>
  String(v || "").replace(/\D/g, "").slice(-10)

const ShippingAddress = ({
  customer,
  cart,
  checked,
  onChange,
}: {
  customer: HttpTypes.StoreCustomer | null
  cart: HttpTypes.StoreCart | null
  checked: boolean
  onChange: () => void
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({
    "shipping_address.first_name": cart?.shipping_address?.first_name || "",
    "shipping_address.last_name": cart?.shipping_address?.last_name || "",
    "shipping_address.address_1": cart?.shipping_address?.address_1 || "",
    "shipping_address.address_2": cart?.shipping_address?.address_2 || "",
    "shipping_address.postal_code": cart?.shipping_address?.postal_code || "",
    "shipping_address.city": cart?.shipping_address?.city || "",
    "shipping_address.country_code":
      cart?.shipping_address?.country_code ||
      cart?.region?.countries?.[0]?.iso_2 ||
      "in",
    "shipping_address.province": cart?.shipping_address?.province || "",
    "shipping_address.phone": toLocalPhone(cart?.shipping_address?.phone),
    email: cart?.email || "",
  })

  const countriesInRegion = useMemo(
    () => cart?.region?.countries?.map((c) => c.iso_2),
    [cart?.region]
  )

  // check if customer has saved addresses that are in the current region
  const addressesInRegion = useMemo(
    () =>
      customer?.addresses.filter(
        (a) => a.country_code && countriesInRegion?.includes(a.country_code)
      ),
    [customer?.addresses, countriesInRegion]
  )

  const setFormAddress = (
    address?: HttpTypes.StoreCartAddress,
    email?: string
  ) => {
    address &&
      setFormData((prevState: Record<string, any>) => ({
        ...prevState,
        "shipping_address.first_name": address?.first_name || "",
        "shipping_address.last_name": address?.last_name || "",
        "shipping_address.address_1": address?.address_1 || "",
        "shipping_address.address_2": address?.address_2 || "",
        "shipping_address.postal_code": address?.postal_code || "",
        "shipping_address.city": address?.city || "",
        "shipping_address.country_code":
          address?.country_code ||
          prevState["shipping_address.country_code"] ||
          "in",
        "shipping_address.province": address?.province || "",
        "shipping_address.phone": toLocalPhone(address?.phone),
      }))

    email &&
      setFormData((prevState: Record<string, any>) => ({
        ...prevState,
        email: email,
      }))
  }

  useEffect(() => {
    // Ensure cart is not null and has a shipping_address before setting form data
    if (cart && cart.shipping_address) {
      setFormAddress(cart?.shipping_address, cart?.email)
    }

    if (cart && !cart.email && customer?.email) {
      setFormAddress(undefined, customer.email)
    }
  }, [cart]) // Add cart as a dependency

  // Auto-fill City + State from an Indian PIN code (server action → India Post).
  const lookupPincode = async (pin: string) => {
    const result = await lookupIndianPincode(pin)
    if (!result) return
    setFormData((prev: Record<string, any>) => ({
      ...prev,
      "shipping_address.city": result.city || prev["shipping_address.city"],
      "shipping_address.province":
        result.state || prev["shipping_address.province"],
    }))
  }

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLInputElement | HTMLSelectElement
    >
  ) => {
    const { name } = e.target
    let value = e.target.value

    // Phone: digits only, max 10 (ISD +91 is fixed and added on submit)
    if (name === "shipping_address.phone") {
      value = value.replace(/\D/g, "").slice(0, 10)
    }
    // Postal code: digits only, max 6 (Indian PIN) — then auto-fill city/state
    if (name === "shipping_address.postal_code") {
      value = value.replace(/\D/g, "").slice(0, 6)
      if (value.length === 6) lookupPincode(value)
    }

    setFormData({
      ...formData,
      [name]: value,
    })
  }

  return (
    <>
      {customer && (addressesInRegion?.length || 0) > 0 && (
        <Container className="mb-6 flex flex-col gap-y-4 p-5">
          <p className="text-small-regular">
            {`Hi ${customer.first_name}, do you want to use one of your saved addresses?`}
          </p>
          <AddressSelect
            addresses={customer.addresses}
            addressInput={
              mapKeys(formData, (_, key) =>
                key.replace("shipping_address.", "")
              ) as HttpTypes.StoreCartAddress
            }
            onSelect={setFormAddress}
          />
        </Container>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="First name"
          name="shipping_address.first_name"
          autoComplete="given-name"
          value={formData["shipping_address.first_name"]}
          onChange={handleChange}
          required
          data-testid="shipping-first-name-input"
        />
        <Input
          label="Last name"
          name="shipping_address.last_name"
          autoComplete="family-name"
          value={formData["shipping_address.last_name"]}
          onChange={handleChange}
          required
          data-testid="shipping-last-name-input"
        />
        <Input
          label="Address line 1"
          name="shipping_address.address_1"
          autoComplete="address-line1"
          value={formData["shipping_address.address_1"]}
          onChange={handleChange}
          required
          className="col-span-2"
          data-testid="shipping-address-input"
        />
        <Input
          label="Address line 2 (optional)"
          name="shipping_address.address_2"
          autoComplete="address-line2"
          value={formData["shipping_address.address_2"]}
          onChange={handleChange}
          className="col-span-2"
          data-testid="shipping-address-2-input"
        />
        <Input
          label="Postal code"
          name="shipping_address.postal_code"
          autoComplete="postal-code"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          title="Enter a valid 6-digit PIN code."
          value={formData["shipping_address.postal_code"]}
          onChange={handleChange}
          required
          data-testid="shipping-postal-code-input"
        />
        <Input
          label="City"
          name="shipping_address.city"
          autoComplete="address-level2"
          value={formData["shipping_address.city"]}
          onChange={handleChange}
          required
          data-testid="shipping-city-input"
        />
        <Input
          label="State"
          name="shipping_address.province"
          autoComplete="address-level1"
          value={formData["shipping_address.province"]}
          onChange={handleChange}
          required
          className="col-span-2"
          data-testid="shipping-province-input"
        />
        {/* Country is fixed to India — submitted as a hidden field. */}
        <input
          type="hidden"
          name="shipping_address.country_code"
          value={formData["shipping_address.country_code"]}
        />
      </div>
      <div className="my-8">
        <Checkbox
          label="Billing address same as shipping address"
          name="same_as_billing"
          checked={checked}
          onChange={onChange}
          data-testid="billing-address-checkbox"
        />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Input
          label="Email"
          name="email"
          type="email"
          title="Enter a valid email address."
          autoComplete="email"
          value={formData.email}
          onChange={handleChange}
          required
          data-testid="shipping-email-input"
        />
        <Input
          label="Phone"
          name="shipping_address.phone"
          type="tel"
          prefix="+91"
          autoComplete="tel-national"
          inputMode="numeric"
          pattern="\d{10}"
          maxLength={10}
          title="Enter a valid 10-digit mobile number."
          value={formData["shipping_address.phone"]}
          onChange={handleChange}
          required
          data-testid="shipping-phone-input"
        />
      </div>
    </>
  )
}

export default ShippingAddress
