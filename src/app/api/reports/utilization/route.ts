import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"

/**
 * GET /api/reports/utilization
 * 
 * Returns utilization data per client/retainer for a given period.
 * Query params:
 *   - from: ISO date string (default: 6 months ago)
 *   - to: ISO date string (default: now)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const now = new Date()
    const sixMonthsAgo = new Date(now)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const from = searchParams.get("from")
      ? new Date(searchParams.get("from") as string)
      : sixMonthsAgo
    const to = searchParams.get("to")
      ? new Date(searchParams.get("to") as string)
      : now

    // Get all active retainers with their periods in the date range
    const retainers = await prisma.retainer.findMany({
      where: {
        tenantId: session.user.tenantId,
        status: "ACTIVE",
      },
      include: {
        client: { select: { id: true, companyName: true } },
        periods: {
          where: {
            periodStart: { gte: from },
            periodEnd: { lte: to },
          },
          orderBy: { periodStart: "asc" },
        },
      },
    })

    const utilization = retainers.map((retainer) => {
      const periods = retainer.periods.map((period) => {
        const included = Number(period.includedHours) + Number(period.rolloverHoursIn)
        const used = Number(period.usedHours)
        const rate = included > 0 ? (used / included) * 100 : 0

        return {
          periodId: period.id,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          includedHours: Number(period.includedHours),
          rolloverIn: Number(period.rolloverHoursIn),
          totalAvailable: included,
          usedHours: used,
          overageHours: Number(period.overageHours),
          utilizationRate: Math.round(rate * 10) / 10,
          status: period.status,
        }
      })

      const totalIncluded = periods.reduce((s, p) => s + p.totalAvailable, 0)
      const totalUsed = periods.reduce((s, p) => s + p.usedHours, 0)
      const avgUtilization = totalIncluded > 0
        ? Math.round((totalUsed / totalIncluded) * 1000) / 10
        : 0

      return {
        retainerId: retainer.id,
        retainerName: retainer.name,
        clientId: retainer.client.id,
        clientName: retainer.client.companyName,
        includedHoursPerPeriod: Number(retainer.includedHours),
        ratePerHour: Number(retainer.ratePerHour),
        averageUtilization: avgUtilization,
        totalUsedHours: totalUsed,
        totalIncludedHours: totalIncluded,
        periods,
      }
    })

    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      retainers: utilization,
    })
  } catch (error: unknown) {
    console.error("Utilization report error:", error)
    return NextResponse.json(
      { error: "Failed to generate utilization report" },
      { status: 500 }
    )
  }
}
