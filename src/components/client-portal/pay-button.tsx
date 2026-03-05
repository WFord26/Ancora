"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export function PayButton({ invoiceId }: { invoiceId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handlePayment() {
    setLoading(true)
    setError("")

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "checkout" }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create payment link")
      }

      const data = await res.json()

      // Redirect to Stripe Checkout
      if (data.data?.checkoutUrl) {
        window.location.href = data.data.checkoutUrl
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button onClick={handlePayment} disabled={loading} className="w-full">
        {loading ? "Preparing payment..." : "Pay Now"}
      </Button>
      {error && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
