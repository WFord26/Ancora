"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type BillingCycle = "MONTHLY" | "BIWEEKLY"

export default function EditRetainerPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [retainer, setRetainer] = useState<any>(null)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY")

  useEffect(() => {
    fetch(`/api/retainers/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        console.log('[Retainer Edit] API response:', data)
        if (data.success && data.data) {
          setRetainer(data.data)
          setBillingCycle((data.data.billingCycle || "MONTHLY") as BillingCycle)
        } else {
          console.error('[Retainer Edit] API error:', data.error)
          setError(data.error || "Failed to load retainer")
        }
        setIsLoading(false)
      })
      .catch((err) => {
        console.error('[Retainer Edit] Fetch error:', err)
        setError(err.message)
        setIsLoading(false)
      })
  }, [params.id])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setIsSaving(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get("name") as string,
      billingCycle,
      includedHours: parseFloat(formData.get("includedHours") as string),
      ratePerHour: parseFloat(formData.get("ratePerHour") as string),
      overageRate: formData.get("overageRate") 
        ? parseFloat(formData.get("overageRate") as string)
        : undefined,
      billingDay:
        billingCycle === "BIWEEKLY"
          ? 0
          : parseInt(formData.get("billingDay") as string),
      rolloverEnabled: formData.get("rolloverEnabled") === "true",
      rolloverCapType: formData.get("rolloverEnabled") === "true" ? ("PERCENTAGE" as const) : undefined,
      rolloverCapValue: formData.get("rolloverEnabled") === "true"
        ? parseFloat(formData.get("rolloverCapPercentage") as string)
        : undefined,
      rolloverExpiryMonths: formData.get("rolloverEnabled") === "true"
        ? parseInt(formData.get("rolloverExpirationMonths") as string)
        : undefined,
      travelTimeBilling: formData.get("travelTimeBilling") as string || undefined,
      travelTimeRate: formData.get("travelTimeRate")
        ? parseFloat(formData.get("travelTimeRate") as string)
        : undefined,
      travelExpensesEnabled: formData.get("travelExpensesEnabled") === "true",
      mileageRate: formData.get("mileageRate")
        ? parseFloat(formData.get("mileageRate") as string)
        : undefined,
      perDiemRate: formData.get("perDiemRate")
        ? parseFloat(formData.get("perDiemRate") as string)
        : undefined,
    }

    try {
      const response = await fetch(`/api/retainers/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update retainer")
      }

      router.push(`/dashboard/retainers/${params.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading retainer...</p>
      </div>
    )
  }

  if (error || !retainer) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error || "Retainer not found"}
        </div>
        <Link href="/dashboard/retainers">
          <Button variant="outline">Back to Retainers</Button>
        </Link>
      </div>
    )
  }

  const isBiweekly = billingCycle === "BIWEEKLY"

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Edit Retainer</h2>
          <p className="text-muted-foreground">
            Changes will apply to future billing periods only
          </p>
        </div>
        <Link href={`/dashboard/retainers/${params.id}`}>
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Retainer Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Retainer Name *</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={retainer.name}
                placeholder="Monthly Support Retainer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="billingCycle">Billing Cycle *</Label>
              <select
                id="billingCycle"
                name="billingCycle"
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="BIWEEKLY">Biweekly</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {isBiweekly
                  ? "Biweekly retainers currently close every Sunday and span 14 days."
                  : "Monthly retainers bill on the same day each month."}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="includedHours">
                  {isBiweekly ? "Included Hours/Biweekly Period *" : "Included Hours/Month *"}
                </Label>
                <Input
                  id="includedHours"
                  name="includedHours"
                  type="number"
                  step="0.5"
                  required
                  defaultValue={Number(retainer.includedHours)}
                  placeholder="40"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ratePerHour">Rate Per Hour ($) *</Label>
                <Input
                  id="ratePerHour"
                  name="ratePerHour"
                  type="number"
                  step="0.01"
                  required
                  defaultValue={Number(retainer.ratePerHour)}
                  placeholder="150.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="overageRate">Overage Rate Per Hour ($)</Label>
              <Input
                id="overageRate"
                name="overageRate"
                type="number"
                step="0.01"
                defaultValue={retainer.overageRate ? Number(retainer.overageRate) : ""}
                placeholder="175.00"
              />
              <p className="text-xs text-muted-foreground">
                Rate charged for hours beyond included hours (defaults to base rate if not specified)
              </p>
            </div>

            {isBiweekly ? (
              <div className="space-y-2">
                <Label htmlFor="billingDayDisplay">Period End Day</Label>
                <Input
                  id="billingDayDisplay"
                  value="Sunday"
                  disabled
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  Biweekly billing is currently anchored to Sunday-to-Sunday periods.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="billingDay">Billing Day of Month *</Label>
                <Input
                  id="billingDay"
                  name="billingDay"
                  type="number"
                  min="1"
                  max="28"
                  required
                  defaultValue={retainer.billingCycle === "BIWEEKLY" ? 1 : retainer.billingDay}
                />
                <p className="text-xs text-muted-foreground">
                  Day 1-28 (avoids month-end issues)
                </p>
              </div>
            )}

            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label htmlFor="rolloverEnabled">Enable Rollover?</Label>
                <select
                  id="rolloverEnabled"
                  name="rolloverEnabled"
                  defaultValue={retainer.rolloverEnabled ? "true" : "false"}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onChange={(e) => {
                    const rolloverFields = document.getElementById("rolloverFields")
                    if (rolloverFields) {
                      rolloverFields.style.display = e.target.value === "true" ? "block" : "none"
                    }
                  }}
                >
                  <option value="false">No - Reset hours monthly</option>
                  <option value="true">Yes - Roll over unused hours</option>
                </select>
              </div>

              <div
                id="rolloverFields"
                style={{ display: retainer.rolloverEnabled ? "block" : "none" }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="rolloverCapPercentage">Rollover Cap (%)</Label>
                  <Input
                    id="rolloverCapPercentage"
                    name="rolloverCapPercentage"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    defaultValue={
                      retainer.rolloverCapType === "PERCENTAGE"
                        ? Number(retainer.rolloverCapValue)
                        : 50
                    }
                    placeholder="50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum percentage of included hours that can roll over
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rolloverExpirationMonths">Expiration (months)</Label>
                  <Input
                    id="rolloverExpirationMonths"
                    name="rolloverExpirationMonths"
                    type="number"
                    min="1"
                    max="12"
                    step="1"
                    defaultValue={retainer.rolloverExpiryMonths || 3}
                    placeholder="3"
                  />
                  <p className="text-xs text-muted-foreground">
                    How many months before rollover hours expire
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-medium">Travel Settings</h3>
              
              <div className="space-y-2">
                <Label htmlFor="travelTimeBilling">Travel Time Billing</Label>
                <select
                  id="travelTimeBilling"
                  name="travelTimeBilling"
                  defaultValue={retainer.travelTimeBilling || ""}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onChange={(e) => {
                    const travelTimeRateField = document.getElementById("travelTimeRateField")
                    if (travelTimeRateField) {
                      travelTimeRateField.style.display = e.target.value !== "" ? "block" : "none"
                    }
                  }}
                >
                  <option value="">Not configured</option>
                  <option value="INCLUDED_HOURS">Count Against Retainer Hours</option>
                  <option value="OVERAGE">Bill as Overage</option>
                  <option value="NON_BILLABLE">Non-Billable</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  How should travel time be billed?
                </p>
              </div>

              <div 
                id="travelTimeRateField" 
                style={{ display: retainer.travelTimeBilling ? "block" : "none" }} 
                className="space-y-2"
              >
                <Label htmlFor="travelTimeRate">Travel Time Rate ($/hour)</Label>
                <Input
                  id="travelTimeRate"
                  name="travelTimeRate"
                  type="number"
                  step="0.01"
                  defaultValue={retainer.travelTimeRate ? Number(retainer.travelTimeRate) : ""}
                  placeholder="75.00"
                />
                <p className="text-xs text-muted-foreground">
                  Optional: Custom rate for travel time (defaults to regular rate)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="travelExpensesEnabled">Travel Expense Reimbursement</Label>
                <select
                  id="travelExpensesEnabled"
                  name="travelExpensesEnabled"
                  defaultValue={retainer.travelExpensesEnabled ? "true" : "false"}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onChange={(e) => {
                    const expenseFields = document.getElementById("travelExpenseFields")
                    if (expenseFields) {
                      expenseFields.style.display = e.target.value === "true" ? "block" : "none"
                    }
                  }}
                >
                  <option value="false">No travel expenses</option>
                  <option value="true">Yes - Track expenses</option>
                </select>
              </div>

              <div 
                id="travelExpenseFields" 
                style={{ display: retainer.travelExpensesEnabled ? "block" : "none" }} 
                className="space-y-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="mileageRate">Mileage Rate ($/mile)</Label>
                    <Input
                      id="mileageRate"
                      name="mileageRate"
                      type="number"
                      step="0.001"
                      defaultValue={retainer.mileageRate ? Number(retainer.mileageRate) : ""}
                      placeholder="0.67"
                    />
                    <p className="text-xs text-muted-foreground">
                      IRS standard rate is $0.67/mile (2024)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="perDiemRate">Per Diem Rate ($/day)</Label>
                    <Input
                      id="perDiemRate"
                      name="perDiemRate"
                      type="number"
                      step="0.01"
                      defaultValue={retainer.perDiemRate ? Number(retainer.perDiemRate) : ""}
                      placeholder="75.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Daily allowance for meals/incidentals
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
              <Link href={`/dashboard/retainers/${params.id}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
        <CardContent className="pt-6">
          <p className="text-sm text-orange-800 dark:text-orange-200">
            <strong>Note:</strong> Changes to included hours, rates, and rollover settings will only affect future billing periods. 
            Current and past periods remain unchanged.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
