/**
 * POST /api/time-entries with biweekly billing support
 * 
 * Updated to:
 * 1. Accept isTravelTime flag
 * 2. Link time entries to current invoice when submitted
 * 3. Auto-assign to correct biweekly period
 */

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/db"
import { 
  getBiweeklyPeriodBoundary,
  toUTC,
} from "@/lib/timezone"
import { z } from "zod"

const createTimeEntrySchema = z.object({
  retainerId: z.string(),
  clientId: z.string(),
  categoryId: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  entryTimezone: z.string(),
  externalDescription: z.string(),
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

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validated = createTimeEntrySchema.parse(body)

    // Fetch retainer and verify access
    const retainer = await prisma.retainer.findUnique({
      where: { id: validated.retainerId },
      include: { client: true },
    })

    if (!retainer) {
      return NextResponse.json(
        { error: "Retainer not found" },
        { status: 404 }
      )
    }

    if (retainer.tenantId !== session.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Calculate duration
    const start = new Date(validated.startTime)
    const end = new Date(validated.endTime)
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000)

    if (durationMinutes <= 0) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      )
    }

    // Find or create retainer period for this entry
    // Use retainer's timezone to determine which period this falls into
    const periodBoundary = getBiweeklyPeriodBoundary(
      start,
      retainer.timezone
    )

    let retainerPeriod = await prisma.retainerPeriod.findFirst({
      where: {
        retainerId: validated.retainerId,
        periodStart: {
          lte: periodBoundary.endUtc,
        },
        periodEnd: {
          gte: periodBoundary.startUtc,
        },
      },
    })

    if (!retainerPeriod) {
      // Create new period if it doesn't exist
      retainerPeriod = await prisma.retainerPeriod.create({
        data: {
          retainerId: validated.retainerId,
          periodStart: periodBoundary.startUtc,
          periodEnd: periodBoundary.endUtc,
          includedHours: retainer.includedHours,
          rolloverHoursIn: 0,
          status: "OPEN",
        },
      })
    }

    // Find current invoice for this retainer
    if (retainerPeriod.status !== "OPEN") {
      return NextResponse.json(
        { error: "Cannot add time to closed period" },
        { status: 400 }
      )
    }

    // Get the most recent invoice for this retainer (current billing period)
    const currentInvoice = await prisma.invoice.findFirst({
      where: {
        retainerPeriodId: retainerPeriod.id,
        status: { in: ["DRAFT", "SENT"] },
      },
      orderBy: { createdAt: "desc" },
    })

    // Create time entry
    const timeEntry = await prisma.timeEntry.create({
      data: {
        tenantId: session.user.tenantId,
        retainerId: validated.retainerId,
        retainerPeriodId: retainerPeriod.id,
        clientId: validated.clientId,
        userId: session.user.id,
        categoryId: validated.categoryId,
        startTime: start,
        endTime: end,
        durationMinutes,
        entryTimezone: validated.entryTimezone,
        externalDescription: validated.externalDescription,
        internalNotes: validated.internalNotes,
        isBillable: validated.isBillable,
        isTravelTime: validated.isTravelTime,
        status: "APPROVED",
        invoiceId: currentInvoice?.id, // Link to current invoice if exists
      },
      include: {
        retainer: true,
        client: true,
        invoice: true,
        category: true,
      },
    })

    return NextResponse.json({
      success: true,
      timeEntry,
      linkedInvoice: currentInvoice?.invoiceNumber || null,
      message: validated.isTravelTime
        ? "Travel time recorded and will be invoiced on next billing"
        : "Time entry recorded",
    })
  } catch (error: any) {
    console.error("Time entry creation error:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || "Failed to create time entry" },
      { status: 500 }
    )
  }
}
