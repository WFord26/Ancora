import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { audit, AuditActions } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"

// GET /api/users/[id] - Get user by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Users can only view themselves, or admins can view anyone
    if (session.user.id !== params.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const user = await prisma.user.findFirst({
      where: {
        id: params.id,
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
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch user" },
      { status: 500 }
    )
  }
}

// PATCH /api/users/[id] - Update user
const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "STAFF", "CLIENT"]).optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
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

    // Users can update themselves, admins can update anyone
    const isOwnProfile = session.user.id === params.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isOwnProfile && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateUserSchema.parse(body)

    // Only admins can change role or isActive
    if (!isAdmin && (validatedData.role || validatedData.isActive !== undefined)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updateData: any = { ...validatedData }

    // Hash password with recommended 12 rounds if provided
    if (validatedData.password) {
      updateData.passwordHash = await bcrypt.hash(validatedData.password, 12)
      delete updateData.password
    }

    // Fetch previous values for audit diff (role and isActive changes)
    const prevUser = await prisma.user.findFirst({
      where: { id: params.id, tenantId: session.user.tenantId },
      select: { role: true, isActive: true },
    })

    const user = await prisma.user.update({
      where: {
        id: params.id,
        tenantId: session.user.tenantId,
      },
      data: updateData,
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

    const ip = getIp(request)

    // Specific high-value events
    if (validatedData.password) {
      await audit({
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: AuditActions.PASSWORD_CHANGED,
        entityType: "User",
        entityId: user.id,
        ipAddress: ip,
      })
    }
    if (prevUser && validatedData.role && validatedData.role !== prevUser.role) {
      await audit({
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: AuditActions.USER_ROLE_CHANGED,
        entityType: "User",
        entityId: user.id,
        metadata: { from: prevUser.role, to: validatedData.role },
        ipAddress: ip,
      })
    }
    if (prevUser && validatedData.isActive === false && prevUser.isActive) {
      await audit({
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: AuditActions.USER_DEACTIVATED,
        entityType: "User",
        entityId: user.id,
        ipAddress: ip,
      })
    } else if (prevUser && validatedData.isActive === true && !prevUser.isActive) {
      await audit({
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: AuditActions.USER_ACTIVATED,
        entityType: "User",
        entityId: user.id,
        ipAddress: ip,
      })
    } else if (!validatedData.password && validatedData.role === prevUser?.role) {
      // Generic update for other field changes
      await audit({
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: AuditActions.USER_UPDATED,
        entityType: "User",
        entityId: user.id,
        metadata: { fields: Object.keys(validatedData) },
        ipAddress: ip,
      })
    }

    return NextResponse.json({
      success: true,
      data: user,
      message: "User updated successfully",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error updating user:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update user" },
      { status: 500 }
    )
  }
}
