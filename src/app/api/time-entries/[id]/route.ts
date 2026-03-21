import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { z } from "zod"
import { toUTC } from "@/lib/timezone"

// GET /api/time-entries/[id] - Get time entry by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const where: any = {
      id: params.id,
      tenantId: session.user.tenantId,
    }

    // Clients can only see their own entries
    if (session.user.role === "CLIENT") {
      where.userId = session.user.id
    }

    const entry = await prisma.timeEntry.findFirst({
      where,
      include: {
        client: true,
        retainer: true,
        category: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!entry) {
      return NextResponse.json(
        { success: false, error: "Time entry not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: entry,
    })
  } catch (error) {
    console.error("Error fetching time entry:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch time entry" },
      { status: 500 }
    )
  }
}

// PATCH /api/time-entries/[id] - Update time entry
const updateTimeEntrySchema = z.object({
  categoryId: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  timezone: z.string().optional(),
  externalDescription: z.string().min(1).optional(),
  internalNotes: z.string().optional(),
  isBillable: z.boolean().optional(),
  isTravelTime: z.boolean().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED"]).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateTimeEntrySchema.parse(body)

    // Get existing entry
    const existingEntry = await prisma.timeEntry.findFirst({
      where: {
        id: params.id,
        tenantId: session.user.tenantId,
      },
      include: {
        retainerPeriod: true,
      },
    })

    if (!existingEntry) {
      return NextResponse.json(
        { success: false, error: "Time entry not found" },
        { status: 404 }
      )
    }

    // Users can only edit their own entries unless they're admin/staff
    if (
      existingEntry.userId !== session.user.id &&
      session.user.role === "CLIENT"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updateData: any = {}

    // Handle time updates
    if (validatedData.startTime || validatedData.endTime) {
      const timezone = validatedData.timezone || existingEntry.entryTimezone
      const startTimeLocal = validatedData.startTime
        ? new Date(validatedData.startTime)
        : existingEntry.startTime
      const endTimeLocal = validatedData.endTime
        ? new Date(validatedData.endTime)
        : existingEntry.endTime

      const startTimeUtc = toUTC(startTimeLocal, timezone)
      const endTimeUtc = toUTC(endTimeLocal, timezone)

      const durationMinutes = Math.round(
        (endTimeUtc.getTime() - startTimeUtc.getTime()) / (1000 * 60)
      )

      if (durationMinutes <= 0) {
        return NextResponse.json(
          { success: false, error: "End time must be after start time" },
          { status: 400 }
        )
      }

      updateData.startTime = startTimeUtc
      updateData.endTime = endTimeUtc
      updateData.durationMinutes = durationMinutes
      updateData.entryTimezone = timezone
    }

    // Add other fields
    if (validatedData.categoryId !== undefined) updateData.categoryId = validatedData.categoryId
    if (validatedData.externalDescription) updateData.externalDescription = validatedData.externalDescription
    if (validatedData.internalNotes !== undefined) updateData.internalNotes = validatedData.internalNotes
    if (validatedData.isBillable !== undefined) updateData.isBillable = validatedData.isBillable
    if (validatedData.isTravelTime !== undefined) updateData.isTravelTime = validatedData.isTravelTime
    if (validatedData.status) updateData.status = validatedData.status

    const timeEntry = await prisma.timeEntry.update({
      where: { id: params.id },
      data: updateData,
      include: {
        client: true,
        retainer: true,
        category: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // Recalculate period usage
    const totalMinutes = await prisma.timeEntry.aggregate({
      where: {
        retainerPeriodId: existingEntry.retainerPeriodId,
        isBillable: true,
      },
      _sum: {
        durationMinutes: true,
      },
    })

    const usedHours = (totalMinutes._sum.durationMinutes || 0) / 60

    await prisma.retainerPeriod.update({
      where: { id: existingEntry.retainerPeriodId },
      data: {
        usedHours,
        overageHours: Math.max(
          0,
          usedHours -
            Number(existingEntry.retainerPeriod.includedHours) -
            Number(existingEntry.retainerPeriod.rolloverHoursIn)
        ),
      },
    })

    return NextResponse.json({
      success: true,
      data: timeEntry,
      message: "Time entry updated successfully",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error updating time entry:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update time entry" },
      { status: 500 }
    )
  }
}

// DELETE /api/time-entries/[id] - Delete time entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const entry = await prisma.timeEntry.findFirst({
      where: {
        id: params.id,
        tenantId: session.user.tenantId,
      },
      include: {
        retainerPeriod: true,
      },
    })

    if (!entry) {
      return NextResponse.json(
        { success: false, error: "Time entry not found" },
        { status: 404 }
      )
    }

    // Users can only delete their own entries unless they're admin/staff
    if (entry.userId !== session.user.id && session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.timeEntry.delete({
      where: { id: params.id },
    })

    // Recalculate period usage
    const totalMinutes = await prisma.timeEntry.aggregate({
      where: {
        retainerPeriodId: entry.retainerPeriodId,
        isBillable: true,
      },
      _sum: {
        durationMinutes: true,
      },
    })

    const usedHours = (totalMinutes._sum.durationMinutes || 0) / 60

    await prisma.retainerPeriod.update({
      where: { id: entry.retainerPeriodId },
      data: {
        usedHours,
        overageHours: Math.max(
          0,
          usedHours -
            Number(entry.retainerPeriod.includedHours) -
            Number(entry.retainerPeriod.rolloverHoursIn)
        ),
      },
    })

    return NextResponse.json({
      success: true,
      message: "Time entry deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting time entry:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete time entry" },
      { status: 500 }
    )
  }
}
