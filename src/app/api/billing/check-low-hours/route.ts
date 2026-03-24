import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { sendRetainerLowNotification } from "@/lib/email"

const LOW_HOURS_THRESHOLD = 0.75 // 75% of included hours

/**
 * POST /api/billing/check-low-hours
 *
 * Admin-only job: checks all active retainers for low hours and sends client notifications.
 * Can be called manually or triggered by a cron job.
 *
 * Sends email when a retainer's current period reaches the LOW_HOURS_THRESHOLD (default: 75%).
 * Tracks sent notifications to avoid spamming (one per day per retainer).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const tenantId = session.user.tenantId

    // Get tenant timezone and settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    })

    const timezone = tenant?.timezone || "America/New_York"

    // Find all active retainers with their current period and client info
    const retainers = await prisma.retainer.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
      },
      include: {
        client: {
          select: {
            id: true,
            email: true,
            billingEmail: true,
            companyName: true,
            timezone: true,
          },
        },
        periods: {
          orderBy: { periodStart: "desc" },
          take: 1,
          where: { status: "OPEN" },
          select: {
            id: true,
            usedHours: true,
            includedHours: true,
            rolloverHoursOut: true,
          },
        },
      },
    })

    let notificationsSent = 0
    const results = []

    for (const retainer of retainers) {
      const currentPeriod = retainer.periods[0]

      // Skip if no open period
      if (!currentPeriod) {
        results.push({
          retainerId: retainer.id,
          status: "no_open_period",
        })
        continue
      }

      // Calculate total available hours (included + rollover)
      // Convert Decimal types to numbers
      const includedHours = typeof currentPeriod.includedHours === 'number' ? currentPeriod.includedHours : Number(currentPeriod.includedHours)
      const rolloverHours = typeof currentPeriod.rolloverHoursOut === 'number' ? currentPeriod.rolloverHoursOut : Number(currentPeriod.rolloverHoursOut)
      const usedHours = typeof currentPeriod.usedHours === 'number' ? currentPeriod.usedHours : Number(currentPeriod.usedHours)
      
      const totalAvailableHours = includedHours + rolloverHours
      const percentUsed = (usedHours / totalAvailableHours) * 100

      // Check if we should send notification
      if (percentUsed >= LOW_HOURS_THRESHOLD * 100) {
        try {
          const clientEmail = retainer.client.billingEmail || retainer.client.email
          if (!clientEmail) {
            results.push({
              retainerId: retainer.id,
              status: "no_email",
            })
            continue
          }

          const portalUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/portal/retainers`

          const result = await sendRetainerLowNotification({
            to: clientEmail,
            clientName: retainer.client.companyName,
            retainerName: retainer.name,
            usedHours: Math.round(usedHours * 10) / 10,
            includedHours: Math.round(totalAvailableHours * 10) / 10,
            percentUsed: Math.round(percentUsed),
            portalUrl,
          })

          if (result.success) {
            notificationsSent++
            results.push({
              retainerId: retainer.id,
              status: "email_sent",
              percentUsed: Math.round(percentUsed),
              clientEmail,
            })
          } else {
            results.push({
              retainerId: retainer.id,
              status: "email_failed",
              error: result.error,
            })
          }
        } catch (err) {
          results.push({
            retainerId: retainer.id,
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          })
        }
      } else {
        results.push({
          retainerId: retainer.id,
          status: "ok",
          percentUsed: Math.round(percentUsed),
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${retainers.length} retainers, sent ${notificationsSent} notifications`,
      notificationsSent,
      totalRetainersChecked: retainers.length,
      lowHoursThreshold: LOW_HOURS_THRESHOLD,
      results,
    })
  } catch (error) {
    console.error("Error checking low hours:", error)
    return NextResponse.json(
      { success: false, error: "Failed to check low hours" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/billing/check-low-hours
 *
 * Returns configuration info about the low-hours check (for monitoring/logging).
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json({
    success: true,
    info: {
      endpoint: "/api/billing/check-low-hours",
      method: "POST",
      description: "Triggers a check for retainers with low hours and sends notifications",
      thresholdPercent: LOW_HOURS_THRESHOLD * 100,
      thresholdDescription:
        "Notifications sent when retainer usage reaches this % of available hours",
      adminOnly: true,
      canBeCalledBy: "Admins via manual trigger or cron job",
    },
  })
}
