import { prisma } from "@/db"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { z } from "zod"

const updateTenantSchema = z.object({
  timezone: z.string().optional(),
  name: z.string().optional(),
})

/**
 * PATCH /api/tenants/timezone
 * Update tenant timezone
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admin can update tenant settings
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateTenantSchema.parse(body)

    const tenant = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: validatedData,
    })

    return NextResponse.json({
      success: true,
      data: tenant,
      message: "Tenant updated successfully",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error updating tenant:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update tenant" },
      { status: 500 }
    )
  }
}
