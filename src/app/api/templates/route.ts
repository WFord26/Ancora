import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { z } from "zod"

// GET /api/templates - List all retainer templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const templates = await prisma.retainerTemplate.findMany({
      where: {
        tenantId: session.user.tenantId,
        isActive: true,
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({
      success: true,
      data: templates,
    })
  } catch (error) {
    console.error("Error fetching templates:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch templates" },
      { status: 500 }
    )
  }
}

// POST /api/templates - Create a new template
const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  includedHours: z.number().positive("Included hours must be positive"),
  ratePerHour: z.number().positive("Rate per hour must be positive"),
  overageTiers: z.array(z.any()).optional(),
  rolloverEnabled: z.boolean().default(false),
  rolloverCapType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  rolloverCapValue: z.number().optional(),
  rolloverExpiryMonths: z.number().int().positive().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createTemplateSchema.parse(body)

    const template = await prisma.retainerTemplate.create({
      data: {
        ...validatedData,
        tenantId: session.user.tenantId,
      },
    })

    return NextResponse.json({
      success: true,
      data: template,
      message: "Template created successfully",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error creating template:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create template" },
      { status: 500 }
    )
  }
}
