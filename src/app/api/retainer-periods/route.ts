import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"

/**
 * GET /api/retainer-periods?retainerId=xxx
 * Returns periods for a retainer (most recent first)
 */
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
    const retainerId = searchParams.get("retainerId")

    if (!retainerId) {
      return NextResponse.json(
        { error: "retainerId required" },
        { status: 400 }
      )
    }

    // Verify retainer belongs to this tenant
    const retainer = await prisma.retainer.findFirst({
      where: { id: retainerId, tenantId: session.user.tenantId },
      select: { id: true },
    })

    if (!retainer) {
      return NextResponse.json({ error: "Retainer not found" }, { status: 404 })
    }

    const periods = await prisma.retainerPeriod.findMany({
      where: { retainerId },
      orderBy: { periodStart: "desc" },
      take: 12,
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        usedHours: true,
        includedHours: true,
      },
    })

    return NextResponse.json({ success: true, data: periods })
  } catch (error) {
    console.error("Error fetching retainer periods:", error)
    return NextResponse.json(
      { error: "Failed to fetch periods" },
      { status: 500 }
    )
  }
}
