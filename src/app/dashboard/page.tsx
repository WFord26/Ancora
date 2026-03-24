import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { getPeriodBoundary } from "@/lib/timezone"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return null
  }

  const tenantId = session.user.tenantId

  // Check if user is admin and onboarding is not complete
  if (session.user.role === "ADMIN") {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { onboardingCompleted: true },
    })

    if (tenant && !tenant.onboardingCompleted) {
      redirect("/dashboard/onboarding")
    }
  }
  const tenantTimezone = (
    await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    })
  )?.timezone || "America/New_York"

  const today = new Date()
  const { startUtc: monthStartUtc, endUtc: monthEndUtc } = getPeriodBoundary(
    today.getFullYear(),
    today.getMonth() + 1,
    tenantTimezone
  )

  // --- Query all necessary data in parallel ---
  const [
    activeRetainerCount,
    activeClientCount,
    hoursThisMonth,
    revenueThisMonth,
    overdueInvoices,
    recentTimeEntries,
    retainersNeedingAttention,
    utilizationData,
  ] = await Promise.all([
    // Active retainers
    prisma.retainer.count({
      where: {
        tenantId,
        status: "ACTIVE",
      },
    }),

    // Active clients
    prisma.client.count({
      where: { tenantId, isActive: true },
    }),

    // Hours this month (sum of billable time entries)
    prisma.timeEntry
      .aggregate({
        where: {
          tenantId,
          isBillable: true,
          startTime: { gte: monthStartUtc, lte: monthEndUtc },
        },
        _sum: { durationMinutes: true },
      })
      .then((r) => (r._sum?.durationMinutes || 0) / 60),

    // Revenue this month (paid + sent invoices in current month)
    prisma.invoice
      .aggregate({
        where: {
          tenantId,
          issuedDate: {
            gte: monthStartUtc,
            lte: monthEndUtc,
          },
          status: { in: ["PAID", "SENT"] },
        },
        _sum: { total: true },
      })
      .then((r) => r._sum?.total || 0),

    // Overdue invoices (due date < today, status not PAID/VOID)
    prisma.invoice.count({
      where: {
        tenantId,
        dueDate: { lt: today },
        status: { notIn: ["PAID", "VOID"] },
      },
    }),

    // Recent time entries (last 5)
    prisma.timeEntry.findMany({
      where: { tenantId },
      include: {
        client: { select: { companyName: true } },
        user: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: { startTime: "desc" },
      take: 5,
    }),

    // Retainers needing attention (low hours, expires soon, paused)
    prisma.retainer.findMany({
      where: {
        tenantId,
        status: { in: ["ACTIVE", "PAUSED"] },
      },
      include: {
        client: { select: { companyName: true } },
        periods: {
          orderBy: { periodStart: "desc" },
          take: 1,
          select: {
            rolloverHoursOut: true,
            includedHours: true,
            usedHours: true,
            rolloverExpiryDate: true,
          },
        },
      },
    }),

    // Utilization chart data (hours used vs included by client, current period)
    prisma.client.findMany({
      where: { tenantId, isActive: true },
      include: {
        retainers: {
          where: { status: "ACTIVE" },
          include: {
            periods: {
              orderBy: { periodStart: "desc" },
              take: 1,
              select: {
                usedHours: true,
                includedHours: true,
              },
            },
          },
        },
      },
      orderBy: { companyName: "asc" },
    }),
  ])

  // Identify retainers needing attention
  const attentionList = retainersNeedingAttention
    .map((retainer) => {
      const currentPeriod = retainer.periods[0]
      if (!currentPeriod) return null

      const usedHours = typeof currentPeriod.usedHours === 'number' ? currentPeriod.usedHours : Number(currentPeriod.usedHours)
      const includedHours = typeof currentPeriod.includedHours === 'number' ? currentPeriod.includedHours : Number(currentPeriod.includedHours)
      const rolloverOut = typeof currentPeriod.rolloverHoursOut === 'number' ? currentPeriod.rolloverHoursOut : Number(currentPeriod.rolloverHoursOut)
      
      const usedPercent = (usedHours / includedHours) * 100
      const hoursRemaining = includedHours - usedHours + rolloverOut

      let reason = ""
      if (retainer.status === "PAUSED") {
        reason = "Paused"
      } else if (usedPercent > 90) {
        reason = "Low on hours"
      } else if (
        currentPeriod.rolloverExpiryDate &&
        currentPeriod.rolloverExpiryDate < new Date()
      ) {
        reason = "Rollover expired"
      } else if (hoursRemaining < 5) {
        reason = `${hoursRemaining.toFixed(1)}h remaining`
      }

      return reason
        ? {
            id: retainer.id,
            clientName: retainer.client.companyName,
            retainerName: retainer.name,
            status: retainer.status,
            reason,
            usedPercent: Math.min(100, usedPercent),
            remaining: Math.max(0, hoursRemaining),
          }
        : null
    })
    .filter(Boolean)
    .slice(0, 5) // Top 5 needing attention

  // Calculate utilization stats for chart
  const chartData = utilizationData
    .map((client) => {
      const totalUsed = client.retainers.reduce((sum, r) => {
        const period = r.periods[0]
        const hours = period?.usedHours ? (typeof period.usedHours === 'number' ? period.usedHours : Number(period.usedHours)) : 0
        return sum + hours
      }, 0)
      const totalIncluded = client.retainers.reduce((sum, r) => {
        const period = r.periods[0]
        const hours = period?.includedHours ? (typeof period.includedHours === 'number' ? period.includedHours : Number(period.includedHours)) : 0
        return sum + hours
      }, 0)

      return totalIncluded > 0
        ? {
            client: client.companyName.substring(0, 20), // truncate for chart
            used: parseFloat(totalUsed.toFixed(1)),
            included: parseFloat(totalIncluded.toFixed(1)),
            utilizationPercent: Math.round((totalUsed / totalIncluded) * 100),
          }
        : null
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => (b?.utilizationPercent || 0) - (a?.utilizationPercent || 0))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome back, {session.user.name}
        </p>
      </div>

      {/* ===== KPI CARDS ===== */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Active Retainers */}
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Active Retainers
          </p>
          <p className="mt-2 text-3xl font-bold">{activeRetainerCount}</p>
          <p className="text-xs text-muted-foreground">
            of {activeClientCount} active client{activeClientCount !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Hours This Month */}
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Hours This Month
          </p>
          <p className="mt-2 text-3xl font-bold">
            {hoursThisMonth.toFixed(1)}
          </p>
          <p className="text-xs text-muted-foreground">Billable hours logged</p>
        </div>

        {/* Revenue This Month */}
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Revenue This Month
          </p>
          <p className="mt-2 text-3xl font-bold">
            ${((typeof revenueThisMonth === 'number' ? revenueThisMonth : Number(revenueThisMonth)) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-muted-foreground">Invoices sent/paid</p>
        </div>

        {/* Overdue Invoices */}
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Overdue Invoices
          </p>
          <p className={`mt-2 text-3xl font-bold ${overdueInvoices > 0 ? "text-destructive" : ""}`}>
            {overdueInvoices}
          </p>
          <p className="text-xs text-muted-foreground">Requiring attention</p>
        </div>
      </div>

      {/* ===== UTILIZATION CHART ===== */}
      {chartData.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Utilization by Client</h3>
          <div className="space-y-3">
            {chartData.map((item) => item && (
              <div key={item.client} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.client}</span>
                  <span className="text-muted-foreground">
                    {item.used.toFixed(1)} / {item.included.toFixed(1)} h
                    ({item.utilizationPercent}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  {/* eslint-disable-next-line react/forbid-dom-props */}
                  <div
                    className={`h-2 rounded-full transition-all ${
                      item.utilizationPercent <= 75
                        ? "bg-green-500"
                        : item.utilizationPercent <= 90
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(100, item.utilizationPercent * 0.9)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== RETAINERS NEEDING ATTENTION ===== */}
      {attentionList.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="border-b p-6">
            <h3 className="text-lg font-semibold">Retainers Needing Attention</h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Retainer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead className="text-right">Hours Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attentionList.map((item) => item && (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.clientName}
                    </TableCell>
                    <TableCell>{item.retainerName}</TableCell>
                    <TableCell>
                      <Badge
                        variant={item.status === "PAUSED" ? "secondary" : "outline"}
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-destructive font-medium">
                        {item.reason}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.remaining.toFixed(1)} h
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ===== RECENT TIME ENTRIES ===== */}
      <div className="rounded-lg border bg-card">
        <div className="border-b p-6">
          <h3 className="text-lg font-semibold">Recent Time Entries</h3>
        </div>
        {recentTimeEntries.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            No time entries yet
          </div>
        ) : (
          <div className="divide-y">
            {recentTimeEntries.map((entry) => (
              <div key={entry.id} className="p-4 hover:bg-accent/50">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{entry.client.companyName}</p>
                    <p className="text-sm text-muted-foreground">
                      {entry.externalDescription}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{entry.user.name}</span>
                      {entry.category && (
                        <>
                          <span>•</span>
                          <span>{entry.category.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{entry.durationMinutes} min</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(entry.startTime).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== QUICK ACTIONS ===== */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Quick Actions</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/dashboard/time-entries">
            <Button variant="outline" className="w-full">
              + Add Time Entry
            </Button>
          </Link>
          <Link href="/dashboard/clients/new">
            <Button variant="outline" className="w-full">
              + New Client
            </Button>
          </Link>
          <Link href="/dashboard/retainers/new">
            <Button variant="outline" className="w-full">
              + New Retainer
            </Button>
          </Link>
          <Link href="/dashboard/reports">
            <Button variant="outline" className="w-full">
              View Reports
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
