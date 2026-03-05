"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

interface AgingInvoice {
  invoiceId: string
  invoiceNumber: string
  clientId: string
  clientName: string
  clientEmail: string | null
  issuedDate: string
  dueDate: string
  total: number
  daysOverdue: number
  bucket: string
}

interface BucketSummary {
  count: number
  total: number
}

interface AgingReport {
  totalOutstanding: number
  totalInvoices: number
  summary: {
    current: BucketSummary
    "1-30": BucketSummary
    "31-60": BucketSummary
    "61-90": BucketSummary
    "90+": BucketSummary
  }
  invoices: AgingInvoice[]
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const BUCKET_COLORS: Record<string, string> = {
  current: "hsl(142, 71%, 45%)",
  "1-30": "hsl(38, 92%, 50%)",
  "31-60": "hsl(25, 95%, 53%)",
  "61-90": "hsl(0, 84%, 60%)",
  "90+": "hsl(0, 72%, 51%)",
}

const BUCKET_LABELS: Record<string, string> = {
  current: "Current",
  "1-30": "1-30 days",
  "31-60": "31-60 days",
  "61-90": "61-90 days",
  "90+": "90+ days",
}

export default function AgingReportPage() {
  const [data, setData] = useState<AgingReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/reports/aging")
        if (!res.ok) throw new Error("Failed to load report")
        const json: AgingReport = await res.json()
        setData(json)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load")
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Aging Invoices</h2>
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg border bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold tracking-tight">Aging Invoices</h2>
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          {error || "No data available"}
        </div>
      </div>
    )
  }

  const chartData = Object.entries(data.summary).map(([bucket, info]) => ({
    name: BUCKET_LABELS[bucket] || bucket,
    amount: info.total,
    count: info.count,
    bucket,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Aging Invoices</h2>
        <p className="text-muted-foreground">
          {data.totalInvoices} outstanding invoices totaling{" "}
          {formatCurrency(data.totalOutstanding)}
        </p>
      </div>

      {/* Bucket Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {Object.entries(data.summary).map(([bucket, info]) => (
          <Card key={bucket}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {BUCKET_LABELS[bucket]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(info.total)}</p>
              <p className="text-xs text-muted-foreground">
                {info.count} invoice{info.count !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Aging Bar Chart */}
      {chartData.some((d) => d.amount > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Outstanding by Age</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                    }
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Amount"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.bucket}
                        fill={BUCKET_COLORS[entry.bucket] || "hsl(var(--primary))"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Table */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent>
          {data.invoices.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No outstanding invoices. Great job!
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 font-medium">Invoice</th>
                    <th className="pb-3 pr-4 font-medium">Client</th>
                    <th className="pb-3 pr-4 font-medium">Issued</th>
                    <th className="pb-3 pr-4 font-medium">Due</th>
                    <th className="pb-3 pr-4 font-medium text-right">Amount</th>
                    <th className="pb-3 pr-4 font-medium text-right">Days Overdue</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((inv) => (
                    <tr key={inv.invoiceId} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{inv.invoiceNumber}</td>
                      <td className="py-3 pr-4">{inv.clientName}</td>
                      <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                        {formatDate(inv.issuedDate)}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium">
                        {formatCurrency(inv.total)}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {inv.daysOverdue > 0 ? (
                          <span className="text-destructive">{inv.daysOverdue}d</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={
                            inv.bucket === "current"
                              ? "secondary"
                              : inv.bucket === "90+"
                                ? "destructive"
                                : "default"
                          }
                        >
                          {BUCKET_LABELS[inv.bucket]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
