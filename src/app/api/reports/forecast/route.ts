import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"

/**
 * GET /api/reports/forecast
 * 
 * Projects revenue and usage based on current retainer agreements
 * and historical trends.
 * 
 * Query params:
 *   - months: number of months to forecast (default: 6)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const forecastMonths = parseInt(searchParams.get("months") || "6", 10)

    // Get active retainers with recent period history for trend analysis
    const retainers = await prisma.retainer.findMany({
      where: {
        tenantId: session.user.tenantId,
        status: "ACTIVE",
      },
      include: {
        client: { select: { id: true, companyName: true } },
        periods: {
          where: { status: { in: ["CLOSED", "BILLED"] } },
          orderBy: { periodStart: "desc" },
          take: 6, // Last 6 periods for trend
        },
      },
    })

    const now = new Date()

    const forecasts = retainers.map((retainer) => {
      const monthlyRetainerFee =
        Number(retainer.includedHours) * Number(retainer.ratePerHour)

      // Calculate average overage from historical periods
      const closedPeriods = retainer.periods
      const avgOverageHours =
        closedPeriods.length > 0
          ? closedPeriods.reduce(
              (sum: number, p: { overageHours: unknown }) => sum + Number(p.overageHours),
              0
            ) / closedPeriods.length
          : 0

      const avgUtilization =
        closedPeriods.length > 0
          ? closedPeriods.reduce((sum: number, p: { usedHours: unknown; includedHours: unknown; rolloverHoursIn: unknown }) => {
              const avail = Number(p.includedHours) + Number(p.rolloverHoursIn)
              return sum + (avail > 0 ? Number(p.usedHours) / avail : 0)
            }, 0) / closedPeriods.length
          : 0

      const overageRate = retainer.overageRate
        ? Number(retainer.overageRate)
        : Number(retainer.ratePerHour)

      const avgOverageRevenue = avgOverageHours * overageRate

      // Project monthly data
      const monthlyProjections = Array.from(
        { length: forecastMonths },
        (_, i) => {
          const month = new Date(now)
          month.setMonth(month.getMonth() + i + 1)
          month.setDate(1)

          return {
            month: month.toISOString().slice(0, 7), // YYYY-MM
            retainerRevenue: Math.round(monthlyRetainerFee * 100) / 100,
            projectedOverageRevenue:
              Math.round(avgOverageRevenue * 100) / 100,
            projectedTotalRevenue:
              Math.round((monthlyRetainerFee + avgOverageRevenue) * 100) / 100,
            projectedHours:
              Math.round(
                Number(retainer.includedHours) * avgUtilization * 10
              ) / 10 + avgOverageHours,
          }
        }
      )

      return {
        retainerId: retainer.id,
        retainerName: retainer.name,
        clientId: retainer.client.id,
        clientName: retainer.client.companyName,
        monthlyRetainerFee: Math.round(monthlyRetainerFee * 100) / 100,
        avgUtilization: Math.round(avgUtilization * 1000) / 10,
        avgOverageHours: Math.round(avgOverageHours * 10) / 10,
        historicalPeriods: closedPeriods.length,
        monthlyProjections,
      }
    })

    // Aggregate monthly totals across all retainers
    const monthlyTotals = Array.from(
      { length: forecastMonths },
      (_, i) => {
        const month = new Date(now)
        month.setMonth(month.getMonth() + i + 1)
        month.setDate(1)
        const monthKey = month.toISOString().slice(0, 7)

        const retainerRevenue = forecasts.reduce(
          (s, f) => s + (f.monthlyProjections[i]?.retainerRevenue || 0),
          0
        )
        const overageRevenue = forecasts.reduce(
          (s, f) =>
            s + (f.monthlyProjections[i]?.projectedOverageRevenue || 0),
          0
        )
        const totalHours = forecasts.reduce(
          (s, f) => s + (f.monthlyProjections[i]?.projectedHours || 0),
          0
        )

        return {
          month: monthKey,
          retainerRevenue: Math.round(retainerRevenue * 100) / 100,
          overageRevenue: Math.round(overageRevenue * 100) / 100,
          totalRevenue:
            Math.round((retainerRevenue + overageRevenue) * 100) / 100,
          totalHours: Math.round(totalHours * 10) / 10,
        }
      }
    )

    const totalProjectedRevenue = monthlyTotals.reduce(
      (s, m) => s + m.totalRevenue,
      0
    )

    return NextResponse.json({
      forecastMonths,
      totalProjectedRevenue: Math.round(totalProjectedRevenue * 100) / 100,
      activeRetainers: retainers.length,
      monthlyTotals,
      retainers: forecasts,
    })
  } catch (error: unknown) {
    console.error("Forecast report error:", error)
    return NextResponse.json(
      { error: "Failed to generate forecast report" },
      { status: 500 }
    )
  }
}
