import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { z } from "zod"

// GET /api/retainers/[id] - Get retainer by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const retainer = await prisma.retainer.findFirst({
      where: {
        id: params.id,
        tenantId: session.user.tenantId,
      },
      include: {
        client: true,
        template: true,
        periods: {
          orderBy: { periodStart: "desc" },
          take: 3,
        },
      },
    })

    if (!retainer) {
      return NextResponse.json(
        { success: false, error: "Retainer not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: retainer,
    })
  } catch (error) {
    console.error("Error fetching retainer:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch retainer" },
      { status: 500 }
    )
  }
}

// PATCH /api/retainers/[id] - Update retainer
const updateRetainerSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "EXPIRED", "CANCELLED"]).optional(),
  includedHours: z.number().positive().optional(),
  ratePerHour: z.number().positive().optional(),
  overageRate: z.number().positive().optional(),
  overageTiers: z.array(z.any()).optional(),
  rolloverEnabled: z.boolean().optional(),
  rolloverCapType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  rolloverCapValue: z.number().optional(),
  rolloverExpiryMonths: z.number().int().positive().optional(),
  travelTimeBilling: z.enum(["INCLUDED_HOURS", "OVERAGE", "NON_BILLABLE"]).optional(),
  travelTimeRate: z.number().positive().optional(),
  travelExpensesEnabled: z.boolean().optional(),
  mileageRate: z.number().positive().optional(),
  perDiemRate: z.number().positive().optional(),
  billingCycle: z.enum(["MONTHLY", "BIWEEKLY"]).optional(),
  billingDay: z.number().int().optional(),
  endDate: z.string().optional(), // ISO date string
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

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateRetainerSchema.parse(body)
    const existingRetainer = await prisma.retainer.findFirst({
      where: {
        id: params.id,
        tenantId: session.user.tenantId,
      },
    })

    if (!existingRetainer) {
      return NextResponse.json(
        { success: false, error: "Retainer not found" },
        { status: 404 }
      )
    }

    const nextBillingCycle = validatedData.billingCycle ?? existingRetainer.billingCycle
    let nextBillingDay = validatedData.billingDay ?? existingRetainer.billingDay

    if (
      nextBillingCycle === "MONTHLY" &&
      existingRetainer.billingCycle === "BIWEEKLY" &&
      validatedData.billingDay === undefined
    ) {
      nextBillingDay = 1
    }

    if (nextBillingCycle === "MONTHLY") {
      if (nextBillingDay < 1 || nextBillingDay > 28) {
        return NextResponse.json(
          {
            success: false,
            error: "Monthly retainers require a billing day between 1 and 28",
          },
          { status: 400 }
        )
      }
    } else {
      if (validatedData.billingDay !== undefined && validatedData.billingDay !== 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Biweekly retainers currently close on Sunday",
          },
          { status: 400 }
        )
      }
      nextBillingDay = 0
    }

    const updateData: any = { ...validatedData }
    
    if (validatedData.endDate) {
      updateData.endDate = new Date(validatedData.endDate)
    }

    if (validatedData.billingCycle || validatedData.billingDay !== undefined) {
      updateData.billingCycle = nextBillingCycle
      updateData.billingDay = nextBillingDay
    }

    const retainer = await prisma.retainer.update({
      where: {
        id: params.id,
        tenantId: session.user.tenantId,
      },
      data: updateData,
      include: {
        client: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: retainer,
      message: "Retainer updated successfully",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error updating retainer:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update retainer" },
      { status: 500 }
    )
  }
}

// DELETE /api/retainers/[id] - Delete retainer
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if retainer exists and belongs to tenant
    const retainer = await prisma.retainer.findFirst({
      where: {
        id: params.id,
        tenantId: session.user.tenantId,
      },
      include: {
        periods: true,
        timeEntries: true,
      },
    })

    if (!retainer) {
      return NextResponse.json(
        { success: false, error: "Retainer not found" },
        { status: 404 }
      )
    }

    // Check if there are any time entries or invoiced periods
    if (retainer.timeEntries.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Cannot delete retainer with time entries. Consider cancelling instead." 
        },
        { status: 400 }
      )
    }

    // Delete retainer (cascade will delete periods)
    await prisma.retainer.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: "Retainer deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting retainer:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete retainer" },
      { status: 500 }
    )
  }
}
