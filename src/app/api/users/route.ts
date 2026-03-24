import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { audit, AuditActions } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"

// GET /api/users - List all users
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          tenantId: session.user.tenantId,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          timezone: true,
          isActive: true,
          createdAt: true,
          avatarUrl: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({
        where: {
          tenantId: session.user.tenantId,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    )
  }
}

// POST /api/users - Create a new user
const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "STAFF", "CLIENT"]),
  timezone: z.string().optional(),
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
    const validatedData = createUserSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "User with this email already exists" },
        { status: 400 }
      )
    }

    // Hash password with recommended 12 rounds
    const passwordHash = await bcrypt.hash(validatedData.password, 12)

    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        name: validatedData.name,
        role: validatedData.role,
        passwordHash,
        timezone: validatedData.timezone,
        tenantId: session.user.tenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        timezone: true,
        isActive: true,
        createdAt: true,
      },
    })

    await audit({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      action: AuditActions.USER_CREATED,
      entityType: "User",
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
      ipAddress: getIp(request),
    })

    return NextResponse.json({
      success: true,
      data: user,
      message: "User created successfully",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error creating user:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create user" },
      { status: 500 }
    )
  }
}
