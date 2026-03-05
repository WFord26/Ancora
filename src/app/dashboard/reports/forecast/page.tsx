"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts"

interface MonthlyTotal {
  month: string
  retainerRevenue: number
  overageRevenue: number
  totalRevenue: number
  totalHours: number
}

interface RetainerForecast {
  retainerId: string
  retainerName: string
  clientId: string
  clientName: string
  monthlyRetainerFee: number
  avgUtilization: number
  avgOverageHours: number
  historicalPeriods: number
  monthlyProjections: {
    month: string
    retainerRevenue: number
    projectedOverageRevenue: number
    projectedTotalRevenue: number
    projectedHours: number
  }[]
}

interface ForecastReport {
  forecastMonths: number
  totalProjectedRevenue: number
  activeRetainers: number
  monthlyTotals: MonthlyTotal[]
  retainers: RetainerForecast[]
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-")
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
}

export default function ForecastReportPage() {
  const [data, setData] = useState<ForecastReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/reports/forecast?months=6")
        if (!res.ok) throw new Error("Failed to load report")
        const json: ForecastReport = await res.json()
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
          <h2 className="text-3xl font-bold tracking-tight">Revenue Forecast</h2>
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg border bg-muted" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-lg border bg-muted" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold tracking-tight">Revenue Forecast</h2>
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          {error || "No data available"}
        </div>
      </div>
    )
  }

  const chartData = data.monthlyTotals.map((m) => ({
    month: formatMonth(m.month),
    retainer: m.retainerRevenue,
    overage: m.overageRevenue,
    total: m.totalRevenue,
    hours: m.totalHours,
  }))

  const monthlyAvg = data.monthlyTotals.length > 0
    ? data.totalProjectedRevenue / data.monthlyTotals.length
    : 0

  const totalProjectedHours = data.monthlyTotals.reduce(
    (s, m) => s + m.totalHours,
    0
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Revenue Forecast</h2>
        <p className="text-muted-foreground">
          {data.forecastMonths}-month projection based on {data.activeRetainers} active
          retainer{data.activeRetainers !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Projected Revenue ({data.forecastMonths}mo)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(data.totalProjectedRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Average
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(monthlyAvg)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Projected Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {Math.round(totalProjectedHours * 10) / 10}h
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Forecast Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Projected Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                    }
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === "retainer"
                        ? "Retainer Fee"
                        : name === "overage"
                          ? "Overage"
                          : "Total",
                    ]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend
                    formatter={(value: string) =>
                      value === "retainer"
                        ? "Retainer Fee"
                        : value === "overage"
                          ? "Projected Overage"
                          : "Total Revenue"
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="retainer"
                    stackId="1"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="overage"
                    stackId="1"
                    stroke="hsl(38, 92%, 50%)"
                    fill="hsl(38, 92%, 50%)"
                    fillOpacity={0.4}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hours Forecast Line */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Projected Monthly Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit="h" />
                  <Tooltip
                    formatter={(value: number) => [`${value}h`, "Hours"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Projected Hours"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Retainer Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Retainer Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 pr-4 font-medium">Client</th>
                  <th className="pb-3 pr-4 font-medium">Retainer</th>
                  <th className="pb-3 pr-4 font-medium text-right">Monthly Fee</th>
                  <th className="pb-3 pr-4 font-medium text-right">Avg Utilization</th>
                  <th className="pb-3 pr-4 font-medium text-right">Avg Overage</th>
                  <th className="pb-3 font-medium text-right">Data Points</th>
                </tr>
              </thead>
              <tbody>
                {data.retainers.map((r) => (
                  <tr key={r.retainerId} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{r.clientName}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{r.retainerName}</td>
                    <td className="py-3 pr-4 text-right">
                      {formatCurrency(r.monthlyRetainerFee)}
                    </td>
                    <td className="py-3 pr-4 text-right">{r.avgUtilization}%</td>
                    <td className="py-3 pr-4 text-right">{r.avgOverageHours}h</td>
                    <td className="py-3 text-right text-muted-foreground">
                      {r.historicalPeriods} period{r.historicalPeriods !== 1 ? "s" : ""}
                    </td>
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
