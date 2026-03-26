import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { getStripeSetupStatus } from "@/lib/stripe"

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

    const stripeSetup = getStripeSetupStatus()
    const filteredConnections = connections.filter(
      (connection) => connection.provider !== "STRIPE"
    )

    const stripeConnection = {
      id: "stripe-env",
      provider: "STRIPE" as const,
      status: stripeSetup.isConfigured
        ? ("ACTIVE" as const)
        : stripeSetup.hasSecretKey || stripeSetup.hasPublishableKey || stripeSetup.hasWebhookSecret
          ? ("ERROR" as const)
          : ("INACTIVE" as const),
      lastSyncAt: null,
      createdAt: new Date(0).toISOString(),
      tokenExpiry: null,
      config: {
        managedBy: "environment",
        hasSecretKey: stripeSetup.hasSecretKey,
        hasPublishableKey: stripeSetup.hasPublishableKey,
        hasWebhookSecret: stripeSetup.hasWebhookSecret,
        webhookUrl: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/stripe/webhook`,
      },
    }

    return NextResponse.json({ success: true, data: [...filteredConnections, stripeConnection] })
  } catch (error) {
    console.error("Error fetching integrations:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch integrations" },
      { status: 500 }
    )
  }
}

// DELETE /api/integrations - Disconnect all (not used directly; handled per-provider below)
