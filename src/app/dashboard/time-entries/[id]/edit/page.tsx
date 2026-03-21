"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function EditTimeEntryPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [entry, setEntry] = useState<any>(null)
  const [clients, setClients] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      fetch(`/api/time-entries/${params.id}`).then((res) => res.json()),
      fetch("/api/clients").then((res) => res.json()),
      fetch("/api/categories").then((res) => res.json()),
    ])
      .then(([entryData, clientsData, categoriesData]) => {
        if (entryData.success && entryData.data) {
          setEntry(entryData.data)
        }
        if (clientsData.success && Array.isArray(clientsData.data)) {
          setClients(clientsData.data)
        }
        if (categoriesData.success && Array.isArray(categoriesData.data)) {
          setCategories(categoriesData.data)
        }
        setIsLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setIsLoading(false)
      })
  }, [params.id])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setIsSaving(true)

    const formData = new FormData(e.currentTarget)
    
    // Combine date and time for start
    const startDate = formData.get("startDate") as string
    const startTime = formData.get("startTime") as string
    const startDateTime = `${startDate}T${startTime}`
    
    // Combine date and time for end
    const endDate = formData.get("endDate") as string || startDate
    const endTime = formData.get("endTime") as string
    const endDateTime = `${endDate}T${endTime}`

    const data = {
      clientId: formData.get("clientId") as string,
      startTime: new Date(startDateTime).toISOString(),
      endTime: new Date(endDateTime).toISOString(),
      externalDescription: formData.get("externalDescription") as string,
      internalNotes: formData.get("internalNotes") as string || null,
      categoryId: formData.get("categoryId") as string || null,
      isTravelTime: (formData.get("isTravelTime") === "on"),
    }

    try {
      const response = await fetch(`/api/time-entries/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update time entry")
      }

      router.push("/dashboard/time-entries")
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this time entry?")) {
      return
    }

    try {
      const response = await fetch(`/api/time-entries/${params.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete time entry")
      }

      router.push("/dashboard/time-entries")
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center p-12">Loading...</div>
  }

  if (!entry) {
    return <div className="flex items-center justify-center p-12">Time entry not found</div>
  }

  // Parse start and end times
  const startDateTime = new Date(entry.startTime)
  const endDateTime = new Date(entry.endTime)
  
  const startDate = startDateTime.toISOString().split("T")[0]
  const startTime = startDateTime.toTimeString().slice(0, 5)
  const endDate = endDateTime.toISOString().split("T")[0]
  const endTime = endDateTime.toTimeString().slice(0, 5)

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Edit Time Entry</h2>
          <p className="text-muted-foreground">
            Update time entry details
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
                defaultValue={entry.clientId}
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  defaultValue={startDate}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  name="startTime"
                  type="time"
                  required
                  defaultValue={startTime}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  required
                  defaultValue={endDate}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endTime">End Time *</Label>
                <Input
                  id="endTime"
                  name="endTime"
                  type="time"
                  required
                  defaultValue={endTime}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">Category</Label>
              <select
                id="categoryId"
                name="categoryId"
                defaultValue={entry.categoryId || ""}
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
                defaultValue={entry.externalDescription}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="internalNotes">Internal Notes</Label>
              <Textarea
                id="internalNotes"
                name="internalNotes"
                defaultValue={entry.internalNotes || ""}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isTravelTime"
                name="isTravelTime"
                defaultChecked={entry.isTravelTime}
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
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
              <Link href="/dashboard/time-entries">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                className="ml-auto"
              >
                Delete Entry
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
