import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/db"

/**
 * GET /api/auth/tenants
 * Get all tenants for the current user
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        tenant: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // For now, return just the user's current tenant
    // In future, this could return multiple tenants if we support multi-tenancy at user level
    const tenants = [user.tenant]

    return NextResponse.json({ tenants })
  } catch (error: any) {
    console.error("Get tenants error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch tenants" },
      { status: 500 }
    )
  }
}
