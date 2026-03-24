import { prisma } from "@/db"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

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

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        onboardingCompleted: true,
        onboardingCompletedAt: true,
        timezone: true,
        _count: {
          select: {
            clients: true,
            retainers: true,
            users: true,
          },
        },
      },
    })

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      )
    }

    // Determine current onboarding step based on setup progress
    let currentStep = 1 // Company setup
    if (tenant._count.clients > 0) currentStep = 2 // Client created
    if (tenant._count.retainers > 0) currentStep = 3 // Retainer created
    if (tenant._count.users > 1) currentStep = 4 // Team invited
    if (tenant.onboardingCompleted) currentStep = 5 // Completed

    return NextResponse.json({
      completed: tenant.onboardingCompleted,
      completedAt: tenant.onboardingCompletedAt,
      currentStep,
      timezone: tenant.timezone,
      stats: {
        clientsCount: tenant._count.clients,
        retainersCount: tenant._count.retainers,
        teamMembersCount: tenant._count.users,
      },
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
