"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function NewRetainerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [clients, setClients] = useState<any[]>([])

  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setClients(data.data)
        }
      })
      .catch(() => setClients([]))
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      clientId: formData.get("clientId") as string,
      name: formData.get("name") as string,
      includedHours: parseFloat(formData.get("includedHours") as string),
      ratePerHour: parseFloat(formData.get("ratePerHour") as string),
      overageRate: formData.get("overageRate") 
        ? parseFloat(formData.get("overageRate") as string)
        : undefined,
      billingDay: parseInt(formData.get("billingDay") as string),
      startDate: formData.get("startDate") as string,
      rolloverEnabled: formData.get("rolloverEnabled") === "true",
      rolloverCapType: formData.get("rolloverEnabled") === "true" ? ("PERCENTAGE" as const) : undefined,
      rolloverCapValue: formData.get("rolloverEnabled") === "true"
        ? parseFloat(formData.get("rolloverCapPercentage") as string)
        : undefined,
      rolloverExpiryMonths: formData.get("rolloverEnabled") === "true"
        ? parseInt(formData.get("rolloverExpirationMonths") as string)
        : undefined,
      travelTimeBilling: formData.get("travelTimeBilling") as "INCLUDED_HOURS" | "OVERAGE" | "NON_BILLABLE" | undefined,
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
      const response = await fetch("/api/retainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create retainer")
      }

      const result = await response.json()
      if (result.success && result.data) {
        router.push(`/dashboard/retainers/${result.data.id}`)
        router.refresh()
      } else {
        throw new Error(result.error || "Failed to create retainer")
      }
    } catch (err: any) {
      setError(err.message)
      setIsLoading(false)
    }
  }

  const defaultClientId = searchParams.get("clientId") || ""

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">New Retainer</h2>
          <p className="text-muted-foreground">
            Create a new retainer agreement
          </p>
        </div>
        <Link href="/dashboard/retainers">
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
              <Label htmlFor="clientId">Client *</Label>
              <select
                id="clientId"
                name="clientId"
                required
                defaultValue={defaultClientId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Retainer Name *</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="Monthly Support Retainer"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="includedHours">Included Hours/Month *</Label>
                <Input
                  id="includedHours"
                  name="includedHours"
                  type="number"
                  step="0.5"
                  required
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
                placeholder="175.00"
              />
              <p className="text-xs text-muted-foreground">
                Rate charged for hours beyond included hours (defaults to base rate if not specified)
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingDay">Billing Day of Month *</Label>
                <Input
                  id="billingDay"
                  name="billingDay"
                  type="number"
                  min="1"
                  max="28"
                  required
                  defaultValue="1"
                />
                <p className="text-xs text-muted-foreground">
                  Day 1-28 (avoids month-end issues)
                </p>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label htmlFor="rolloverEnabled">Enable Rollover?</Label>
                <select
                  id="rolloverEnabled"
                  name="rolloverEnabled"
                  defaultValue="true"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onChange={(e) => {
                    const rolloverFields = document.getElementById("rolloverFields")
                    if (rolloverFields) {
                      rolloverFields.style.display = e.target.value === "true" ? "block" : "none"
                    }
                  }}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div id="rolloverFields" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="rolloverCapPercentage">Rollover Cap (%)</Label>
                    <Input
                      id="rolloverCapPercentage"
                      name="rolloverCapPercentage"
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      defaultValue="50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Max % of included hours that can roll over
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rolloverExpirationMonths">Expires After (months)</Label>
                    <Input
                      id="rolloverExpirationMonths"
                      name="rolloverExpirationMonths"
                      type="number"
                      min="1"
                      max="12"
                      defaultValue="3"
                    />
                    <p className="text-xs text-muted-foreground">
                      Unused hours expire after this many months
                    </p>
                  </div>
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

              <div id="travelTimeRateField" style={{ display: "none" }} className="space-y-2">
                <Label htmlFor="travelTimeRate">Travel Time Rate ($/hour)</Label>
                <Input
                  id="travelTimeRate"
                  name="travelTimeRate"
                  type="number"
                  step="0.01"
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
                  defaultValue="false"
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

              <div id="travelExpenseFields" style={{ display: "none" }} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="mileageRate">Mileage Rate ($/mile)</Label>
                    <Input
                      id="mileageRate"
                      name="mileageRate"
                      type="number"
                      step="0.001"
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
                      placeholder="75.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Daily allowance for meals/incidentals
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Retainer"}
              </Button>
              <Link href="/dashboard/retainers">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
