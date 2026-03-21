import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { z } from "zod"
import { toUTC, getPeriodForTimestamp } from "@/lib/timezone"

// GET /api/time-entries - List time entries
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get("clientId")
    const retainerId = searchParams.get("retainerId")
    const userId = searchParams.get("userId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    const where: any = {
      tenantId: session.user.tenantId,
    }

    // Clients can only see their own entries
    if (session.user.role === "CLIENT") {
      where.userId = session.user.id
    } else {
      if (clientId) where.clientId = clientId
      if (retainerId) where.retainerId = retainerId
      if (userId) where.userId = userId
    }

    if (startDate && endDate) {
      where.startTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const [entries, total] = await Promise.all([
      prisma.timeEntry.findMany({
        where,
        include: {
          client: {
            select: { id: true, companyName: true },
          },
          retainer: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, name: true, email: true },
          },
          category: {
            select: { id: true, name: true, color: true },
          },
        },
        skip,
        take: limit,
        orderBy: { startTime: "desc" },
      }),
      prisma.timeEntry.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching time entries:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch time entries" },
      { status: 500 }
    )
  }
}

// POST /api/time-entries - Create a new time entry
const createTimeEntrySchema = z.object({
  retainerId: z.string().min(1, "Retainer is required"),
  categoryId: z.string().optional(),
  startTime: z.string(), // ISO string
  endTime: z.string(), // ISO string
  timezone: z.string().default("America/New_York"),
  externalDescription: z.string().min(1, "Description is required"),
  internalNotes: z.string().optional(),
  isBillable: z.boolean().default(true),
  isTravelTime: z.boolean().default(false),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createTimeEntrySchema.parse(body)

    // Get retainer and verify access
    const retainer = await prisma.retainer.findFirst({
      where: {
        id: validatedData.retainerId,
        tenantId: session.user.tenantId,
      },
      include: {
        client: true,
      },
    })

    if (!retainer) {
      return NextResponse.json(
        { success: false, error: "Retainer not found" },
        { status: 404 }
      )
    }

    // Convert times to UTC
    const startTimeLocal = new Date(validatedData.startTime)
    const endTimeLocal = new Date(validatedData.endTime)
    const startTimeUtc = toUTC(startTimeLocal, validatedData.timezone)
    const endTimeUtc = toUTC(endTimeLocal, validatedData.timezone)

    // Calculate duration in minutes
    const durationMinutes = Math.round(
      (endTimeUtc.getTime() - startTimeUtc.getTime()) / (1000 * 60)
    )

    if (durationMinutes <= 0) {
      return NextResponse.json(
        { success: false, error: "End time must be after start time" },
        { status: 400 }
      )
    }

    // Determine which period this entry belongs to
    const { year, month } = getPeriodForTimestamp(startTimeUtc, retainer.timezone)
    
    // Find or create the period
    const periodStart = new Date(year, month - 1, 1)
    const periodEnd = new Date(year, month, 0)
    
    let period = await prisma.retainerPeriod.findFirst({
      where: {
        retainerId: retainer.id,
        periodStart: {
          lte: startTimeUtc,
        },
        periodEnd: {
          gte: startTimeUtc,
        },
      },
    })

    if (!period) {
      // Create period if it doesn't exist
      period = await prisma.retainerPeriod.create({
        data: {
          retainerId: retainer.id,
          periodStart: toUTC(periodStart, retainer.timezone),
          periodEnd: toUTC(periodEnd, retainer.timezone),
          includedHours: retainer.includedHours,
          rolloverHoursIn: 0,
          status: "OPEN",
        },
      })
    }

    // Create time entry
    const timeEntry = await prisma.timeEntry.create({
      data: {
        tenantId: session.user.tenantId,
        retainerId: retainer.id,
        retainerPeriodId: period.id,
        userId: session.user.id,
        clientId: retainer.clientId,
        categoryId: validatedData.categoryId,
        startTime: startTimeUtc,
        endTime: endTimeUtc,
        durationMinutes,
        entryTimezone: validatedData.timezone,
        externalDescription: validatedData.externalDescription,
        internalNotes: validatedData.internalNotes,
        isBillable: validatedData.isBillable,
        isTravelTime: validatedData.isTravelTime,
        status: "APPROVED",
      },
      include: {
        client: true,
        retainer: true,
        category: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // Update period used hours
    const totalMinutes = await prisma.timeEntry.aggregate({
      where: {
        retainerPeriodId: period.id,
        isBillable: true,
      },
      _sum: {
        durationMinutes: true,
      },
    })

    const usedHours = (totalMinutes._sum.durationMinutes || 0) / 60

    await prisma.retainerPeriod.update({
      where: { id: period.id },
      data: {
        usedHours,
        overageHours: Math.max(0, usedHours - Number(period.includedHours) - Number(period.rolloverHoursIn)),
      },
    })

    return NextResponse.json({
      success: true,
      data: timeEntry,
      message: "Time entry created successfully",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error creating time entry:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create time entry" },
      { status: 500 }
    )
  }
}
