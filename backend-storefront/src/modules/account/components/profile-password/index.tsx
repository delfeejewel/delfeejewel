"use client"

import React, { useEffect, useActionState } from "react"
import Input from "@modules/common/components/input"
import AccountInfo from "../account-info"
import { HttpTypes } from "@medusajs/types"
import { updateCustomerPassword } from "@lib/data/customer"

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
}

const ProfilePassword: React.FC<MyInformationProps> = ({ customer }) => {
  const [successState, setSuccessState] = React.useState(false)

  const updatePassword = async (
    _currentState: { success: boolean; error: string | null },
    formData: FormData
  ) => {
    const old_password = formData.get("old_password") as string
    const new_password = formData.get("new_password") as string
    const confirm_password = formData.get("confirm_password") as string

    if (!old_password || !new_password) {
      return { success: false, error: "Please fill in all fields." }
    }
    if (new_password.length < 8) {
      return {
        success: false,
        error: "New password must be at least 8 characters.",
      }
    }
    if (new_password !== confirm_password) {
      return { success: false, error: "New passwords do not match." }
    }

    const res = await updateCustomerPassword({ old_password, new_password })
    return { success: res.success, error: res.error ?? null }
  }

  const [state, formAction] = useActionState(updatePassword, {
    success: false,
    error: null,
  })

  const clearState = () => {
    setSuccessState(false)
  }

  useEffect(() => {
    setSuccessState(state.success)
  }, [state])

  return (
    <form action={formAction} onReset={() => clearState()} className="w-full">
      <AccountInfo
        label="Password"
        currentInfo={
          <span>The password is not shown for security reasons</span>
        }
        isSuccess={successState}
        isError={!!state.error}
        errorMessage={state.error ?? undefined}
        clearState={clearState}
        data-testid="account-password-editor"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Old password"
            name="old_password"
            required
            type="password"
            data-testid="old-password-input"
          />
          <Input
            label="New password"
            type="password"
            name="new_password"
            required
            data-testid="new-password-input"
          />
          <Input
            label="Confirm password"
            type="password"
            name="confirm_password"
            required
            data-testid="confirm-password-input"
          />
        </div>
      </AccountInfo>
    </form>
  )
}

export default ProfilePassword
