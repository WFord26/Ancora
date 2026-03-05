"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface ClientProfitability {
  clientId: string
  clientName: string
  totalRevenue: number
  paidRevenue: number
  outstandingRevenue: number
  totalHoursWorked: number
  totalBillableExpenses: number
  effectiveHourlyRate: number
  contractedRate: number
  invoiceCount: number
  activeRetainers: number
}

interface ProfitabilityReport {
  from: string
  to: string
  summary: {
    totalRevenue: number
    totalPaid: number
    totalHours: number
    clientCount: number
  }
  clients: ClientProfitability[]
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatMonth(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  })
}

export default function ProfitabilityReportPage() {
  const [data, setData] = useState<ProfitabilityReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/reports/profitability")
        if (!res.ok) throw new Error("Failed to load report")
        const json: ProfitabilityReport = await res.json()
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
          <h2 className="text-3xl font-bold tracking-tight">Profitability Report</h2>
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg border bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold tracking-tight">Profitability Report</h2>
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          {error || "No data available"}
        </div>
      </div>
    )
  }

  const chartData = data.clients.slice(0, 10).map((c) => ({
    name: c.clientName.length > 18 ? c.clientName.slice(0, 16) + "…" : c.clientName,
    revenue: c.totalRevenue,
    paid: c.paidRevenue,
    outstanding: c.outstandingRevenue,
  }))

  const avgEffectiveRate = data.clients.length > 0
    ? Math.round(
        data.clients.reduce((s, c) => s + c.effectiveHourlyRate, 0) /
          data.clients.filter((c) => c.effectiveHourlyRate > 0).length * 100
      ) / 100
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Profitability Report</h2>
        <p className="text-muted-foreground">
          Revenue and performance by client ({formatMonth(data.from)} – {formatMonth(data.to)})
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(data.summary.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Collected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(data.summary.totalPaid)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.summary.totalHours}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Effective Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${avgEffectiveRate}/hr</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Client (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value)]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="paid"
                    fill="hsl(142, 71%, 45%)"
                    name="Paid"
                    stackId="revenue"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="outstanding"
                    fill="hsl(38, 92%, 50%)"
                    name="Outstanding"
                    stackId="revenue"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle>Client Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 pr-4 font-medium">Client</th>
                  <th className="pb-3 pr-4 font-medium text-right">Revenue</th>
                  <th className="pb-3 pr-4 font-medium text-right">Paid</th>
                  <th className="pb-3 pr-4 font-medium text-right">Hours</th>
                  <th className="pb-3 pr-4 font-medium text-right">Eff. Rate</th>
                  <th className="pb-3 pr-4 font-medium text-right">Contract Rate</th>
                  <th className="pb-3 font-medium text-right">Invoices</th>
                </tr>
              </thead>
              <tbody>
                {data.clients.map((c) => (
                  <tr key={c.clientId} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{c.clientName}</td>
                    <td className="py-3 pr-4 text-right">{formatCurrency(c.totalRevenue)}</td>
                    <td className="py-3 pr-4 text-right text-green-600 dark:text-green-400">
                      {formatCurrency(c.paidRevenue)}
                    </td>
                    <td className="py-3 pr-4 text-right">{c.totalHoursWorked}h</td>
                    <td className="py-3 pr-4 text-right">
                      <span
                        className={
                          c.effectiveHourlyRate >= c.contractedRate
                            ? "text-green-600 dark:text-green-400"
                            : "text-destructive"
                        }
                      >
                        ${c.effectiveHourlyRate}/hr
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">${c.contractedRate}/hr</td>
                    <td className="py-3 text-right">{c.invoiceCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
