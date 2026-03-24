"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, Loader2, ArrowRight } from "lucide-react"
import OnboardingLayout from "../layout"

export default function RetainerSetupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [clients, setClients] = useState<any[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [skipRetainer, setSkipRetainer] = useState(false)
  const [selectedClient, setSelectedClient] = useState("")

  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setClients(data.data)
          if (data.data.length > 0) {
            setSelectedClient(data.data[0].id)
          }
        }
      })
      .catch(() => setClients([]))
      .finally(() => setLoadingClients(false))
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      if (skipRetainer || !selectedClient) {
        router.push("/dashboard/onboarding/team")
        return
      }

      const formData = new FormData(e.currentTarget)
      const data = {
        clientId: selectedClient,
        name: formData.get("name") as string,
        includedHours: parseFloat(formData.get("includedHours") as string),
        ratePerHour: parseFloat(formData.get("ratePerHour") as string),
        overageRate: formData.get("overageRate")
          ? parseFloat(formData.get("overageRate") as string)
          : undefined,
        billingDay: parseInt(formData.get("billingDay") as string) || 1,
        startDate: new Date().toISOString().split("T")[0],
        rolloverEnabled: formData.get("rolloverEnabled") === "true",
        rolloverCapType: formData.get("rolloverEnabled") === "true" ? "PERCENTAGE" : undefined,
        rolloverCapValue:
          formData.get("rolloverEnabled") === "true"
            ? parseFloat(formData.get("rolloverCapPercentage") as string) || 25
            : undefined,
        rolloverExpiryMonths: formData.get("rolloverEnabled") === "true" ? 3 : undefined,
      }

      const response = await fetch("/api/retainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create retainer")
      }

      router.push("/dashboard/onboarding/team")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <OnboardingLayout currentStep={3} totalSteps={5}>
      <CardHeader>
        <CardTitle>Create Your First Retainer</CardTitle>
        <CardDescription>
          Set up a retainer billing agreement. You can add more retainers anytime.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex gap-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {!skipRetainer ? (
            <div className="space-y-4">
              {loadingClients ? (
                <div className="p-4 text-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                  Loading clients...
                </div>
              ) : clients.length === 0 ? (
                <div className="p-4 text-center bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-sm text-amber-200">
                    You need to create a client first to set up a retainer.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => router.push("/dashboard/clients/new")}
                  >
                    Create Client First
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="clientId">Select Client *</Label>
                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                      <SelectTrigger id="clientId">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="name">Retainer Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      required
                      placeholder="Monthly Support Retainer"
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      e.g., "Standard Retainer", "Premium Support", etc.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="includedHours">Included Hours/Month *</Label>
                      <Input
                        id="includedHours"
                        name="includedHours"
                        type="number"
                        step="0.5"
                        required
                        placeholder="40"
                        defaultValue="40"
                        disabled={isLoading}
                      />
                    </div>

                    <div>
                      <Label htmlFor="ratePerHour">Rate Per Hour ($) *</Label>
                      <Input
                        id="ratePerHour"
                        name="ratePerHour"
                        type="number"
                        step="0.01"
                        required
                        placeholder="150.00"
                        defaultValue="150"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="overageRate">Overage Rate Per Hour ($)</Label>
                      <Input
                        id="overageRate"
                        name="overageRate"
                        type="number"
                        step="0.01"
                        placeholder="175.00"
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Optional</p>
                    </div>

                    <div>
                      <Label htmlFor="billingDay">Billing Day of Month</Label>
                      <Input
                        id="billingDay"
                        name="billingDay"
                        type="number"
                        min="1"
                        max="28"
                        placeholder="1"
                        defaultValue="1"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="rolloverEnabled">Hour Rollover Policy</Label>
                    <Select name="rolloverEnabled" defaultValue="true">
                      <SelectTrigger id="rolloverEnabled">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Enable rollover (recommended)</SelectItem>
                        <SelectItem value="false">No rollover (hours expire)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Rollover lets unused hours carry to next month (capped)
                    </p>
                  </div>

                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
                    <p className="text-sm text-blue-200">
                      <strong>💡 Quick math:</strong> {getMonthlyFee()} monthly fee for this retainer
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="py-6 text-center space-y-4">
              <div className="text-5xl">⏳</div>
              <div>
                <p className="font-medium">Skip for now</p>
                <p className="text-sm text-slate-400">You can set up retainers from the dashboard anytime</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-between flex-wrap">
            <div>
              {!skipRetainer && clients.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSkipRetainer(true)}
                  disabled={isLoading}
                >
                  Skip this step
                </Button>
              )}
              {skipRetainer && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSkipRetainer(false)}
                  disabled={isLoading}
                >
                  Add retainer
                </Button>
              )}
            </div>
            <Button type="submit" disabled={isLoading || (clients.length === 0 && !skipRetainer)} className="gap-2">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </OnboardingLayout>
  )
}

function getMonthlyFee(): string {
  if (typeof window !== "undefined") {
    const hours = (document.querySelector('input[name="includedHours"]') as HTMLInputElement)?.value || "40"
    const rate = (document.querySelector('input[name="ratePerHour"]') as HTMLInputElement)?.value || "150"
    const fee = parseFloat(hours) * parseFloat(rate)
    return `$${fee.toFixed(2)}`
  }
  return "$6,000"
}
