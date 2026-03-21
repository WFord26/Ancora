import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { z } from "zod"

// GET /api/clients - List all clients
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where: {
          tenantId: session.user.tenantId,
          isActive: true,
        },
        include: {
          retainers: {
            where: { status: "ACTIVE" },
            select: { id: true, name: true },
          },
        },
        skip,
        take: limit,
        orderBy: { companyName: "asc" },
      }),
      prisma.client.count({
        where: {
          tenantId: session.user.tenantId,
          isActive: true,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: clients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching clients:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch clients" },
      { status: 500 }
    )
  }
}

// POST /api/clients - Create a new client
const createClientSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  primaryContactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  billingEmail: z.string().email().optional().or(z.literal("")),
  timezone: z.string().optional(),
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
    const validatedData = createClientSchema.parse(body)

    const client = await prisma.client.create({
      data: {
        ...validatedData,
        tenantId: session.user.tenantId,
      },
    })

    return NextResponse.json({
      success: true,
      data: client,
      message: "Client created successfully",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error creating client:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create client" },
      { status: 500 }
    )
  }
}
