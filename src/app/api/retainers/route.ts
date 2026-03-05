import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { z } from "zod"
import { getPeriodBoundary } from "@/lib/timezone"

// GET /api/retainers - List all retainers
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get("clientId")
    const status = searchParams.get("status")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    const where: any = {
      tenantId: session.user.tenantId,
    }

    if (clientId) {
      where.clientId = clientId
    }

    if (status) {
      where.status = status
    }

    const [retainers, total] = await Promise.all([
      prisma.retainer.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              companyName: true,
            },
          },
          periods: {
            where: { status: "OPEN" },
            orderBy: { periodStart: "desc" },
            take: 1,
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.retainer.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: retainers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching retainers:", error)
    console.error("Error details:", JSON.stringify(error, null, 2))
    return NextResponse.json(
      { success: false, error: "Failed to fetch retainers", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// POST /api/retainers - Create a new retainer
const createRetainerSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  name: z.string().min(1, "Name is required"),
  templateId: z.string().optional(),
  includedHours: z.number().positive("Included hours must be positive"),
  ratePerHour: z.number().positive("Rate per hour must be positive"),
  overageRate: z.number().positive("Overage rate must be positive").optional(),
  overageTiers: z.array(z.any()).optional(),
  rolloverEnabled: z.boolean().default(false),
  rolloverCapType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  rolloverCapValue: z.number().optional(),
  rolloverExpiryMonths: z.number().int().positive().optional(),
  travelTimeBilling: z.enum(["INCLUDED_HOURS", "OVERAGE", "NON_BILLABLE"]).optional(),
  travelTimeRate: z.number().positive().optional(),
  travelExpensesEnabled: z.boolean().default(false),
  mileageRate: z.number().positive().optional(),
  perDiemRate: z.number().positive().optional(),
  timezone: z.string().optional(),
  billingDay: z.number().int().min(1).max(28).default(1),
  startDate: z.string(), // ISO date string
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
    const validatedData = createRetainerSchema.parse(body)

    // Verify client exists and belongs to tenant
    const client = await prisma.client.findFirst({
      where: {
        id: validatedData.clientId,
        tenantId: session.user.tenantId,
      },
    })

    if (!client) {
      return NextResponse.json(
        { success: false, error: "Client not found" },
        { status: 404 }
      )
    }

    // Get tenant for default timezone
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
    })

    const timezone = validatedData.timezone || tenant?.timezone || "America/New_York"
    const startDate = new Date(validatedData.startDate)

    // Create retainer
    const retainer = await prisma.retainer.create({
      data: {
        tenantId: session.user.tenantId,
        clientId: validatedData.clientId,
        templateId: validatedData.templateId,
        name: validatedData.name,
        includedHours: validatedData.includedHours,
        ratePerHour: validatedData.ratePerHour,
        overageRate: validatedData.overageRate,
        overageTiers: validatedData.overageTiers || undefined,
        rolloverEnabled: validatedData.rolloverEnabled,
        rolloverCapType: validatedData.rolloverCapType,
        rolloverCapValue: validatedData.rolloverCapValue,
        rolloverExpiryMonths: validatedData.rolloverExpiryMonths,
        travelTimeBilling: validatedData.travelTimeBilling,
        travelTimeRate: validatedData.travelTimeRate,
        travelExpensesEnabled: validatedData.travelExpensesEnabled,
        mileageRate: validatedData.mileageRate,
        perDiemRate: validatedData.perDiemRate,
        timezone,
        billingDay: validatedData.billingDay,
        startDate,
      },
      include: {
        client: true,
      },
    })

    // Create initial period
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const { startUtc, endUtc } = getPeriodBoundary(currentYear, currentMonth, timezone)

    await prisma.retainerPeriod.create({
      data: {
        retainerId: retainer.id,
        periodStart: startUtc,
        periodEnd: endUtc,
        includedHours: validatedData.includedHours,
        rolloverHoursIn: 0,
        status: "OPEN",
      },
    })

    return NextResponse.json({
      success: true,
      data: retainer,
      message: "Retainer created successfully",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error creating retainer:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create retainer" },
      { status: 500 }
    )
  }
}
