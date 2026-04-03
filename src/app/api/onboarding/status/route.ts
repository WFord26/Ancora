import { prisma } from "@/db"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getOnboardingStatus } from "@/lib/onboarding"

/**
 * GET /api/onboarding/status
 * Get user's onboarding status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const status = await getOnboardingStatus(session.user.tenantId)

    if (!status) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...status,
    })
  } catch (error: any) {
    console.error("Onboarding status error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get onboarding status" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/onboarding/complete
 * Mark onboarding as completed
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admin can complete onboarding
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const tenant = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
      },
    })

    return NextResponse.json({
      message: "Onboarding completed",
      tenant,
    })
  } catch (error: any) {
    console.error("Onboarding complete error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to complete onboarding" },
      { status: 500 }
    )
  }
}
