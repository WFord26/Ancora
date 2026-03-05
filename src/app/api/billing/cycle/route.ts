import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { 
  calculateRollover, 
  calculateOverage, 
  decimalToNumber,
  numberToDecimal,
  type OverageTier,
  type RolloverConfig,
  type PeriodUsage 
} from "@/lib/billing"
import { addMonths } from "date-fns"
import { toZonedTime } from "date-fns-tz"

/**
 * POST /api/billing/cycle
 * 
 * Trigger billing cycle for a specific retainer
 * This closes the current period, calculates rollover/overage,
 * and opens a new period.
 * 
 * Admin/Staff only
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { retainerId } = body

    if (!retainerId) {
      return NextResponse.json(
        { error: "retainerId is required" },
        { status: 400 }
      )
    }

    // Fetch retainer with current open period
    const retainer = await prisma.retainer.findUnique({
      where: {
        id: retainerId,
        tenantId: session.user.tenantId,
      },
      include: {
        periods: {
          where: { status: "OPEN" },
          orderBy: { periodStart: "desc" },
          take: 1,
        },
      },
    })

    if (!retainer) {
      return NextResponse.json({ error: "Retainer not found" }, { status: 404 })
    }

    if (retainer.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Cannot run billing cycle for non-active retainer" },
        { status: 400 }
      )
    }

    const currentPeriod = retainer.periods[0]
    if (!currentPeriod) {
      return NextResponse.json(
        { error: "No open period found for retainer" },
        { status: 400 }
      )
    }

    // Calculate total used hours from time entries
    const timeEntriesSum = await prisma.timeEntry.aggregate({
      where: {
        retainerPeriodId: currentPeriod.id,
        isBillable: true,
      },
      _sum: {
        durationMinutes: true,
      },
    })

    const usedMinutes = timeEntriesSum._sum.durationMinutes || 0
    const usedHours = usedMinutes / 60

    // Prepare usage data for calculations
    const usage: PeriodUsage = {
      includedHours: decimalToNumber(currentPeriod.includedHours),
      rolloverHoursIn: decimalToNumber(currentPeriod.rolloverHoursIn),
      usedHours,
    }

    // Parse overage tiers from JSON
    const overageTiers = retainer.overageTiers as OverageTier[] | null
    const flatOverageRate = retainer.overageRate 
      ? decimalToNumber(retainer.overageRate) 
      : decimalToNumber(retainer.ratePerHour)

    // Calculate overage
    const overageResult = calculateOverage(usage, overageTiers, flatOverageRate)

    // Prepare rollover config
    const rolloverConfig: RolloverConfig = {
      enabled: retainer.rolloverEnabled,
      capType: retainer.rolloverCapType || "PERCENTAGE",
      capValue: retainer.rolloverCapValue ? decimalToNumber(retainer.rolloverCapValue) : 0,
      expiryMonths: retainer.rolloverExpiryMonths || 3,
    }

    // Convert period end to retainer timezone for rollover calculation
    const periodEndInTz = toZonedTime(currentPeriod.periodEnd, retainer.timezone)

    // Calculate rollover
    const rolloverResult = calculateRollover(
      usage,
      rolloverConfig,
      periodEndInTz,
      retainer.timezone
    )

    // Close current period
    await prisma.retainerPeriod.update({
      where: { id: currentPeriod.id },
      data: {
        status: "CLOSED",
        usedHours: numberToDecimal(usage.usedHours),
        overageHours: numberToDecimal(overageResult.overageHours),
        rolloverHoursOut: numberToDecimal(rolloverResult.rolloverHoursOut),
      },
    })

    // Calculate next period boundaries
    const nextPeriodStart = currentPeriod.periodEnd
    const nextPeriodEnd = addMonths(nextPeriodStart, 1)

    // Open new period
    const newPeriod = await prisma.retainerPeriod.create({
      data: {
        retainerId: retainer.id,
        periodStart: nextPeriodStart,
        periodEnd: nextPeriodEnd,
        includedHours: retainer.includedHours,
        rolloverHoursIn: numberToDecimal(rolloverResult.rolloverHoursOut),
        rolloverExpiryDate: rolloverResult.expiryDate,
        usedHours: 0,
        overageHours: 0,
        rolloverHoursOut: 0,
        status: "OPEN",
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        closedPeriod: {
          id: currentPeriod.id,
          usedHours: usage.usedHours,
          overageHours: overageResult.overageHours,
          overageCost: overageResult.overageCost,
          rolloverHoursOut: rolloverResult.rolloverHoursOut,
          expiredHours: rolloverResult.expiredHours,
        },
        newPeriod: {
          id: newPeriod.id,
          periodStart: newPeriod.periodStart,
          periodEnd: newPeriod.periodEnd,
          rolloverHoursIn: rolloverResult.rolloverHoursOut,
        },
        calculations: {
          overage: overageResult,
          rollover: rolloverResult,
        },
      },
    })
  } catch (error) {
    console.error("Error running billing cycle:", error)
    return NextResponse.json(
      { success: false, error: "Failed to run billing cycle" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/billing/cycle
 * 
 * Get billing cycle status - list active retainers with their current period.
 * Admin/Staff only.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const retainers = await prisma.retainer.findMany({
      where: {
        tenantId: session.user.tenantId,
        status: "ACTIVE",
      },
      include: {
        client: { select: { companyName: true } },
        periods: {
          where: { status: "OPEN" },
          take: 1,
          orderBy: { periodStart: "desc" },
        },
      },
      orderBy: { name: "asc" },
    })

    const data = retainers.map((retainer: any) => {
      const currentPeriod = retainer.periods[0]
      return {
        retainerId: retainer.id,
        retainerName: retainer.name,
        clientName: retainer.client.companyName,
        currentPeriod: currentPeriod
          ? {
              id: currentPeriod.id,
              periodStart: currentPeriod.periodStart,
              periodEnd: currentPeriod.periodEnd,
              status: currentPeriod.status,
              includedHours: Number(currentPeriod.includedHours),
              usedHours: Number(currentPeriod.usedHours),
              rolloverHoursIn: Number(currentPeriod.rolloverHoursIn),
              isDue: currentPeriod.periodEnd <= new Date(),
            }
          : null,
      }
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("Error fetching billing cycle status:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch billing cycle status" },
      { status: 500 }
    )
  }
}
