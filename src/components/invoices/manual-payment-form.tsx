"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ManualPaymentFormProps {
  invoiceId: string
  balanceDue: number
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function ManualPaymentForm({
  invoiceId,
  balanceDue,
}: ManualPaymentFormProps) {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [paidDate, setPaidDate] = useState(getTodayIsoDate())
  const [paymentMethod, setPaymentMethod] = useState("check")
  const [paymentReference, setPaymentReference] = useState("")

  const amountLabel = useMemo(() => `$${balanceDue.toFixed(2)}`, [balanceDue])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paidDate,
          paymentMethod: paymentMethod.trim(),
          paymentReference: paymentReference.trim() || undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to mark invoice as paid")
      }

      setSuccess("Invoice marked as paid")
      setIsExpanded(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Failed to mark invoice as paid")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setIsExpanded((open) => !open)
            setError("")
            setSuccess("")
          }}
        >
          {isExpanded ? "Cancel Manual Entry" : "Mark Paid Manually"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Use this for offline payments like checks, ACH, wires, or cash. The invoice
        will be marked paid for the remaining balance of {amountLabel}.
      </p>

      {isExpanded && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manual-paid-date">Payment Date</Label>
              <Input
                id="manual-paid-date"
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-payment-method">Payment Method</Label>
              <Input
                id="manual-payment-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="check"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-payment-reference">Reference</Label>
            <Input
              id="manual-payment-reference"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="Check #1048, ACH trace, wire confirmation, etc."
              disabled={isSubmitting}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving Payment..." : `Record ${amountLabel} Payment`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsExpanded(false)}
              disabled={isSubmitting}
            >
              Close
            </Button>
          </div>
        </form>
      )}

      {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
