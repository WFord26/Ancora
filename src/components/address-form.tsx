"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface AddressFormData {
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
}

interface AddressFormProps {
  data?: AddressFormData
  required?: boolean
}

export function AddressForm({ data, required = false }: AddressFormProps) {
  const requiredMark = required ? " *" : ""

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Address</h3>

      <div>
        <Label htmlFor="addressLine1">Address Line 1{requiredMark}</Label>
        <Input
          id="addressLine1"
          name="addressLine1"
          placeholder="123 Main St"
          defaultValue={data?.addressLine1 || ""}
          required={required}
        />
      </div>

      <div>
        <Label htmlFor="addressLine2">Address Line 2</Label>
        <Input
          id="addressLine2"
          name="addressLine2"
          placeholder="Suite, Apt, Unit, etc."
          defaultValue={data?.addressLine2 || ""}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <Label htmlFor="city">City{requiredMark}</Label>
          <Input
            id="city"
            name="city"
            placeholder="Denver"
            defaultValue={data?.city || ""}
            required={required}
          />
        </div>

        <div>
          <Label htmlFor="state">State{requiredMark}</Label>
          <Input
            id="state"
            name="state"
            placeholder="CO"
            defaultValue={data?.state || ""}
            required={required}
            maxLength={2}
          />
        </div>

        <div>
          <Label htmlFor="zipCode">Zip Code{requiredMark}</Label>
          <Input
            id="zipCode"
            name="zipCode"
            placeholder="80202"
            defaultValue={data?.zipCode || ""}
            required={required}
          />
        </div>
      </div>
    </div>
  )
}
