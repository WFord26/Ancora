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

interface PeriodData {
  periodId: string
  periodStart: string
  periodEnd: string
  includedHours: number
  rolloverIn: number
  totalAvailable: number
  usedHours: number
  overageHours: number
  utilizationRate: number
  status: string
}

interface RetainerUtilization {
  retainerId: string
  retainerName: string
  clientId: string
  clientName: string
  includedHoursPerPeriod: number
  ratePerHour: number
  averageUtilization: number
  totalUsedHours: number
  totalIncludedHours: number
  periods: PeriodData[]
}

interface UtilizationReport {
  from: string
  to: string
  retainers: RetainerUtilization[]
}

function formatMonth(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  })
}

export default function UtilizationReportPage() {
  const [data, setData] = useState<UtilizationReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/reports/utilization")
        if (!res.ok) throw new Error("Failed to load report")
        const json: UtilizationReport = await res.json()
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
          <h2 className="text-3xl font-bold tracking-tight">Utilization Report</h2>
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
        <h2 className="text-3xl font-bold tracking-tight">Utilization Report</h2>
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          {error || "No data available"}
        </div>
      </div>
    )
  }

  // Build chart data: one bar per retainer showing avg utilization
  const chartData = data.retainers.map((r) => ({
    name: r.clientName.length > 20 ? r.clientName.slice(0, 18) + "…" : r.clientName,
    utilization: r.averageUtilization,
    usedHours: r.totalUsedHours,
    includedHours: r.totalIncludedHours,
  }))

  // Summary stats
  const totalUsed = data.retainers.reduce((s, r) => s + r.totalUsedHours, 0)
  const totalIncluded = data.retainers.reduce((s, r) => s + r.totalIncludedHours, 0)
  const avgUtilization = totalIncluded > 0
    ? Math.round((totalUsed / totalIncluded) * 1000) / 10
    : 0
  const overUtilized = data.retainers.filter((r) => r.averageUtilization > 100)
  const underUtilized = data.retainers.filter((r) => r.averageUtilization < 50)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Utilization Report</h2>
        <p className="text-muted-foreground">
          Retainer usage rates across clients ({formatMonth(data.from)} – {formatMonth(data.to)})
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Utilization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{avgUtilization}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Hours Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{Math.round(totalUsed * 10) / 10}h</p>
            <p className="text-xs text-muted-foreground">of {Math.round(totalIncluded * 10) / 10}h available</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Over 100%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{overUtilized.length}</p>
            <p className="text-xs text-muted-foreground">retainers with overage</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Under 50%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{underUtilized.length}</p>
            <p className="text-xs text-muted-foreground">low utilization</p>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Utilization by Client</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="name"
                    className="text-xs"
                    tick={{ fontSize: 12 }}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    unit="%"
                    tick={{ fontSize: 12 }}
                    domain={[0, (max: number) => Math.max(max + 10, 110)]}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, "Utilization"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="utilization"
                    fill="hsl(var(--primary))"
                    name="Utilization %"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Retainer Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle>Retainer Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 pr-4 font-medium">Client</th>
                  <th className="pb-3 pr-4 font-medium">Retainer</th>
                  <th className="pb-3 pr-4 font-medium text-right">Included</th>
                  <th className="pb-3 pr-4 font-medium text-right">Used</th>
                  <th className="pb-3 pr-4 font-medium text-right">Utilization</th>
                  <th className="pb-3 font-medium text-right">Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.retainers.map((r) => (
                  <tr key={r.retainerId} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{r.clientName}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{r.retainerName}</td>
                    <td className="py-3 pr-4 text-right">{r.totalIncludedHours}h</td>
                    <td className="py-3 pr-4 text-right">{r.totalUsedHours}h</td>
                    <td className="py-3 pr-4 text-right">
                      <span
                        className={
                          r.averageUtilization > 100
                            ? "font-bold text-destructive"
                            : r.averageUtilization < 50
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-green-600 dark:text-green-400"
                        }
                      >
                        {r.averageUtilization}%
                      </span>
                    </td>
                    <td className="py-3 text-right">${r.ratePerHour}/hr</td>
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
