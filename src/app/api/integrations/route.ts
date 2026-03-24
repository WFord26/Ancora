import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"

// GET /api/integrations - List all integration connections for the tenant
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const connections = await prisma.integrationConnection.findMany({
      where: { tenantId: session.user.tenantId },
      select: {
        id: true,
        provider: true,
        status: true,
        lastSyncAt: true,
        createdAt: true,
        tokenExpiry: true,
        config: true,
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ success: true, data: connections })
  } catch (error) {
    console.error("Error fetching integrations:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch integrations" },
      { status: 500 }
    )
  }
}

// DELETE /api/integrations - Disconnect all (not used directly; handled per-provider below)
