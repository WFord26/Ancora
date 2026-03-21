"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function NewTimeEntryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [clients, setClients] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState("")
  const [retainers, setRetainers] = useState<any[]>([])
  const [loadingRetainers, setLoadingRetainers] = useState(false)
  const [isTravelTime, setIsTravelTime] = useState(false)

  useEffect(() => {
    // Fetch clients and categories
    Promise.all([
      fetch("/api/clients").then((res) => res.json()),
      fetch("/api/categories").then((res) => res.json()),
    ])
      .then(([clientsData, categoriesData]) => {
        if (clientsData.success && Array.isArray(clientsData.data)) {
          setClients(clientsData.data)
        }
        if (categoriesData.success && Array.isArray(categoriesData.data)) {
          setCategories(categoriesData.data)
        }
      })
      .catch(() => {
        setClients([])
        setCategories([])
      })
  }, [])

  // Fetch retainers when client is selected
  useEffect(() => {
    if (!selectedClientId) {
      setRetainers([])
      return
    }

    setLoadingRetainers(true)
    fetch(`/api/retainers?clientId=${selectedClientId}&status=ACTIVE`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setRetainers(data.data)
        } else {
          setRetainers([])
        }
        setLoadingRetainers(false)
      })
      .catch(() => {
        setRetainers([])
        setLoadingRetainers(false)
      })
  }, [selectedClientId])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const retainerId = formData.get("retainerId") as string
    
    // Find timezone from selected retainer
    const selectedRetainer = retainers.find((r) => r.id === retainerId)
    const timezone = selectedRetainer?.client?.timezone || "America/New_York"
    
    // Combine date and time for start
    const startDate = formData.get("startDate") as string
    const startTime = formData.get("startTime") as string
    const startDateTime = `${startDate}T${startTime}`
    
    // Combine date and time for end
    const endDate = formData.get("endDate") as string || startDate
    const endTime = formData.get("endTime") as string
    const endDateTime = `${endDate}T${endTime}`

    const data = {
      retainerId: retainerId,
      startTime: startDateTime,
      endTime: endDateTime,
      timezone: timezone,
      externalDescription: formData.get("externalDescription") as string,
      internalNotes: formData.get("internalNotes") as string || null,
      categoryId: formData.get("categoryId") as string || null,
      isTravelTime,
    }

    try {
      const response = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create time entry")
      }

      router.push("/dashboard/time-entries")
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setIsLoading(false)
    }
  }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0]
    const now = new Date().toTimeString().slice(0, 5)
    
    // Default client from URL param
    const defaultClientId = searchParams.get("clientId") || ""
    
    // Set client if provided in URL
    useEffect(() => {
      if (defaultClientId) {
        setSelectedClientId(defaultClientId)
      }
    }, [defaultClientId])

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">New Time Entry</h2>
          <p className="text-muted-foreground">
            Record billable hours
          </p>
        </div>
        <Link href="/dashboard/time-entries">
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time Entry Details</CardTitle>
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
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
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

            {selectedClientId && (
              <div className="space-y-2">
                <Label htmlFor="retainerId">Retainer *</Label>
                <select
                  id="retainerId"
                  name="retainerId"
                  required
                  disabled={loadingRetainers}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {loadingRetainers ? "Loading retainers..." : "Select a retainer"}
                  </option>
                  {retainers.map((retainer) => (
                    <option key={retainer.id} value={retainer.id}>
                      {retainer.name}
                    </option>
                  ))}
                </select>
                {retainers.length === 0 && !loadingRetainers && selectedClientId && (
                  <p className="text-xs text-muted-foreground">
                    No active retainers for this client
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  defaultValue={today}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  name="startTime"
                  type="time"
                  required
                  defaultValue="09:00"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={today}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty if same as start date
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endTime">End Time *</Label>
                <Input
                  id="endTime"
                  name="endTime"
                  type="time"
                  required
                  defaultValue="10:00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">Category</Label>
              <select
                id="categoryId"
                name="categoryId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="externalDescription">Description (Client-Visible) *</Label>
              <Textarea
                id="externalDescription"
                name="externalDescription"
                required
                placeholder="Brief description of work performed..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="internalNotes">Internal Notes</Label>
              <Textarea
                id="internalNotes"
                name="internalNotes"
                placeholder="Internal notes (not visible to client)..."
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isTravelTime"
                checked={isTravelTime}
                onChange={(e) => setIsTravelTime(e.target.checked)}
                className="h-4 w-4 rounded border"
              />
              <Label htmlFor="isTravelTime" className="cursor-pointer">
                Travel Time
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (billed on next invoice)
                </span>
              </Label>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Time Entry"}
              </Button>
              <Link href="/dashboard/time-entries">
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
