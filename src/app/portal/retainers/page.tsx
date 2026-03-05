import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function PortalRetainersPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return null
  }

  const client = await prisma.client.findFirst({
    where: {
      tenantId: session.user.tenantId,
      email: session.user.email,
    },
  })

  if (!client) {
    return (
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Retainers</h2>
        <p className="mt-2 text-muted-foreground">
          Account not linked to a client profile.
        </p>
      </div>
    )
  }

  const retainers = await prisma.retainer.findMany({
    where: { clientId: client.id },
    include: {
      periods: {
        orderBy: { periodStart: "desc" },
        take: 6, // Current + last 5
      },
    },
    orderBy: { name: "asc" },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Retainers</h2>
        <p className="text-muted-foreground">
          View your retainer agreements and usage history
        </p>
      </div>

      {retainers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No retainers found.
          </CardContent>
        </Card>
      ) : (
        retainers.map((retainer) => {
          const currentPeriod = retainer.periods.find((p) => p.status === "OPEN")
          const pastPeriods = retainer.periods.filter((p) => p.status === "CLOSED")
          const includedHours = Number(retainer.includedHours)
          const usedHours = currentPeriod ? Number(currentPeriod.usedHours) : 0
          const rolloverIn = currentPeriod ? Number(currentPeriod.rolloverHoursIn) : 0
          const totalAvailable = includedHours + rolloverIn
          const utilization = totalAvailable > 0 ? (usedHours / totalAvailable) * 100 : 0
          const remaining = Math.max(0, totalAvailable - usedHours)

          return (
            <Card key={retainer.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{retainer.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {includedHours} included hours/month ·{" "}
                      ${Number(retainer.ratePerHour).toFixed(2)}/hr
                    </p>
                  </div>
                  <Badge
                    variant={
                      retainer.status === "ACTIVE" ? "default" : "secondary"
                    }
                  >
                    {retainer.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Period */}
                {currentPeriod && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">Current Period</h4>
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {new Date(currentPeriod.periodStart).toLocaleDateString()} –{" "}
                          {new Date(currentPeriod.periodEnd).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold">{usedHours.toFixed(1)}</p>
                          <p className="text-xs text-muted-foreground">Used</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{remaining.toFixed(1)}</p>
                          <p className="text-xs text-muted-foreground">Remaining</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{rolloverIn.toFixed(1)}</p>
                          <p className="text-xs text-muted-foreground">Rollover</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{totalAvailable.toFixed(1)}</p>
                          <p className="text-xs text-muted-foreground">Total Avail.</p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Utilization</span>
                          <span>{Math.min(utilization, 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-3 rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full transition-all ${
                              utilization > 100
                                ? "bg-destructive"
                                : utilization > 80
                                ? "bg-yellow-500"
                                : "bg-primary"
                            }`}
                            style={{ width: `${Math.min(utilization, 100)}%` }}
                          />
                        </div>
                        {utilization > 100 && (
                          <p className="mt-1 text-xs text-destructive">
                            {(usedHours - totalAvailable).toFixed(1)} hours over limit
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Past Periods */}
                {pastPeriods.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">Past Periods</h4>
                    <div className="space-y-2">
                      {pastPeriods.map((period) => {
                        const pIncluded = Number(period.includedHours)
                        const pUsed = Number(period.usedHours)
                        const pOverage = Number(period.overageHours)
                        const pRollout = Number(period.rolloverHoursOut)

                        return (
                          <div
                            key={period.id}
                            className="flex items-center justify-between rounded-lg border p-3 text-sm"
                          >
                            <span className="text-muted-foreground">
                              {new Date(period.periodStart).toLocaleDateString()} –{" "}
                              {new Date(period.periodEnd).toLocaleDateString()}
                            </span>
                            <div className="flex gap-4">
                              <span>{pUsed.toFixed(1)} / {pIncluded} hrs</span>
                              {pOverage > 0 && (
                                <Badge variant="destructive">
                                  +{pOverage.toFixed(1)} overage
                                </Badge>
                              )}
                              {pRollout > 0 && (
                                <Badge variant="secondary">
                                  {pRollout.toFixed(1)} rolled over
                                </Badge>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
