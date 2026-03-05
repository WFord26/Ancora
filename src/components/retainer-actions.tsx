"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface RetainerActionsProps {
  retainerId: string
  retainerStatus: string
  hasTimeEntries?: boolean
}

export function RetainerActions({ retainerId, retainerStatus, hasTimeEntries }: RetainerActionsProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [error, setError] = useState("")

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this retainer? This will set the status to CANCELLED.")) {
      return
    }

    setIsCancelling(true)
    setError("")

    try {
      const response = await fetch(`/api/retainers/${retainerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to cancel retainer")
      }

      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setIsCancelling(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this retainer? This action cannot be undone.")) {
      return
    }

    setIsDeleting(true)
    setError("")

    try {
      const response = await fetch(`/api/retainers/${retainerId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete retainer")
      }

      router.push("/dashboard/retainers")
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setIsDeleting(false)
    }
  }

  const canCancel = retainerStatus === "ACTIVE" || retainerStatus === "PAUSED"
  const canDelete = !hasTimeEntries

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}
      
      <div className="flex gap-2">
        <Link href={`/dashboard/retainers/${retainerId}/edit`}>
          <Button variant="outline" size="sm">
            Edit
          </Button>
        </Link>

        {canCancel && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isCancelling}
          >
            {isCancelling ? "Cancelling..." : "Cancel Retainer"}
          </Button>
        )}

        {canDelete && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        )}
      </div>

      {!canDelete && (
        <p className="text-xs text-muted-foreground">
          Cannot delete retainer with time entries
        </p>
      )}
    </div>
  )
}
