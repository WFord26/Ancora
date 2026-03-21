import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { z } from "zod"

const timerStopSchema = z.object({
  retainerId: z.string().min(1),
  clientId: z.string().min(1),
  categoryId: z.string().optional(),
  startUtc: z.string().datetime(),
  endUtc: z.string().datetime(),
  durationMs: z.number().positive(),
  userTimezone: z.string().min(1),
  externalDescription: z.string().min(1),
  internalNotes: z.string().optional(),
  isBillable: z.boolean().default(true),
  isTravelTime: z.boolean().default(false),
})

/**
 * POST /api/time-entries/timer
 * 
 * Create a time entry from a stopped timer.
 * Timer runs client-side; server validates and stores.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validated = timerStopSchema.parse(body)

    const startTime = new Date(validated.startUtc)
    const endTime = new Date(validated.endUtc)

    // Validate duration matches UTC delta (within 5 second tolerance)
    const utcDeltaMs = endTime.getTime() - startTime.getTime()
    const tolerance = 5000 // 5 seconds
    if (Math.abs(utcDeltaMs - validated.durationMs) > tolerance) {
      return NextResponse.json(
        { error: "Duration mismatch. Please try again." },
        { status: 400 }
      )
    }

    const durationMinutes = Math.round(validated.durationMs / 60000)
    if (durationMinutes < 1) {
      return NextResponse.json(
        { error: "Timer duration too short (minimum 1 minute)" },
        { status: 400 }
      )
    }

    // Verify retainer belongs to tenant
    const retainer = await prisma.retainer.findFirst({
      where: {
        id: validated.retainerId,
        tenantId: session.user.tenantId,
        clientId: validated.clientId,
      },
    })

    if (!retainer) {
      return NextResponse.json(
        { error: "Retainer not found" },
        { status: 404 }
      )
    }

    // Find or create the appropriate retainer period
    const period = await prisma.retainerPeriod.findFirst({
      where: {
        retainerId: validated.retainerId,
        periodStart: { lte: startTime },
        periodEnd: { gt: startTime },
      },
    })

    if (!period) {
      return NextResponse.json(
        { error: "No active period found for this retainer" },
        { status: 400 }
      )
    }

    // Create time entry
    const timeEntry = await prisma.timeEntry.create({
      data: {
        tenantId: session.user.tenantId,
        retainerId: validated.retainerId,
        retainerPeriodId: period.id,
        userId: session.user.id,
        clientId: validated.clientId,
        categoryId: validated.categoryId || null,
        startTime,
        endTime,
        durationMinutes,
        entryTimezone: validated.userTimezone,
        externalDescription: validated.externalDescription,
        internalNotes: validated.internalNotes || null,
        isBillable: validated.isBillable,
        isTravelTime: validated.isTravelTime,
        status: "APPROVED",
      },
      include: {
        client: { select: { companyName: true } },
        category: { select: { name: true } },
      },
    })

    // Update period used hours
    await prisma.retainerPeriod.update({
      where: { id: period.id },
      data: {
        usedHours: { increment: durationMinutes / 60 },
      },
    })

    return NextResponse.json({ success: true, timeEntry }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Timer stop error:", error)
    return NextResponse.json(
      { error: "Failed to save time entry" },
      { status: 500 }
    )
  }
}
