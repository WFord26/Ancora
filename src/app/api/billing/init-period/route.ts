import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { getRetainerPeriodBoundary } from "@/lib/timezone"

/**
 * POST /api/billing/init-period
 * 
 * Initialize the first billing period for a retainer
 * Called after creating a new retainer
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

    // Fetch retainer
    const retainer = await prisma.retainer.findUnique({
      where: {
        id: retainerId,
        tenantId: session.user.tenantId,
      },
      include: {
        periods: {
          where: { status: "OPEN" },
          take: 1,
        },
      },
    })

    if (!retainer) {
      return NextResponse.json({ error: "Retainer not found" }, { status: 404 })
    }

    // Check if period already exists
    if (retainer.periods.length > 0) {
      return NextResponse.json(
        { error: "Retainer already has an open period" },
        { status: 400 }
      )
    }

    const { startUtc: periodStart, endUtc: periodEnd } = getRetainerPeriodBoundary(
      retainer.startDate,
      retainer.timezone,
      retainer.billingCycle,
      retainer.billingDay
    )

    // Create first period
    const newPeriod = await prisma.retainerPeriod.create({
      data: {
        retainerId: retainer.id,
        periodStart,
        periodEnd,
        includedHours: retainer.includedHours,
        rolloverHoursIn: 0, // No rollover for first period
        rolloverExpiryDate: null,
        usedHours: 0,
        overageHours: 0,
        rolloverHoursOut: 0,
        status: "OPEN",
      },
    })

    return NextResponse.json({
      success: true,
      data: newPeriod,
    })
  } catch (error) {
    console.error("Error initializing period:", error)
    return NextResponse.json(
      { success: false, error: "Failed to initialize period" },
      { status: 500 }
    )
  }
}
