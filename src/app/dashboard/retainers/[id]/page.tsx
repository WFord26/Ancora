import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RetainerActions } from "@/components/retainer-actions"

export default async function RetainerDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return null
  }

  const retainer = await prisma.retainer.findUnique({
    where: {
      id: params.id,
      tenantId: session.user.tenantId,
    },
    include: {
      client: {
        select: {
          id: true,
          companyName: true,
          primaryContactName: true,
          email: true,
        },
      },
      periods: {
        orderBy: { periodStart: "desc" },
        take: 6,
      },
      _count: {
        select: {
          timeEntries: true,
        },
      },
    },
  })

  if (!retainer) {
    notFound()
  }

  const currentPeriod = retainer.periods.find((p) => p.status === "OPEN")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {retainer.name}
          </h2>
          <p className="text-muted-foreground">
            {retainer.client.companyName}
          </p>
        </div>
        <div className="flex gap-2">
          <RetainerActions 
            retainerId={retainer.id}
            retainerStatus={retainer.status}
            hasTimeEntries={retainer._count.timeEntries > 0}
          />
          <Link href={`/dashboard/clients/${retainer.clientId}`}>
            <Button variant="outline">View Client</Button>
          </Link>
          <Link href="/dashboard/retainers">
            <Button variant="outline">Back to Retainers</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Retainer Details */}
        <Card>
          <CardHeader>
            <CardTitle>Retainer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <div className="mt-1">
                <Badge
                  variant={
                    retainer.status === "ACTIVE"
                      ? "default"
                      : retainer.status === "PAUSED"
                      ? "secondary"
                      : retainer.status === "CANCELLED"
                      ? "destructive"
                      : "outline"
                  }
                >
                  {retainer.status}
                </Badge>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Monthly Cost</p>
              <p className="mt-1 text-2xl font-bold">${(Number(retainer.ratePerHour) * Number(retainer.includedHours)).toFixed(2)}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Included Hours</p>
              <p className="mt-1 text-lg">{Number(retainer.includedHours)} hours/month</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Rate Per Hour</p>
              <p className="mt-1">${Number(retainer.ratePerHour).toFixed(2)}/hour</p>
            </div>

            {retainer.overageRate && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overage Rate</p>
                <p className="mt-1">${Number(retainer.overageRate).toFixed(2)}/hour</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-muted-foreground">Billing Day</p>
              <p className="mt-1">Day {retainer.billingDay} of month</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Rollover</p>
              <p className="mt-1">
                {retainer.rolloverEnabled
                  ? `Enabled (${retainer.rolloverCapValue}% cap, ${retainer.rolloverExpiryMonths} month expiry)`
                  : "Disabled"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Current Period */}
        {currentPeriod && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Current Period</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Period Start</p>
                  <p className="mt-1">
                    {new Date(currentPeriod.periodStart).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Period End</p>
                  <p className="mt-1">
                    {new Date(currentPeriod.periodEnd).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-accent/50 p-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Included</p>
                    <p className="mt-1 text-xl font-bold">{Number(currentPeriod.includedHours)}h</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Rollover</p>
                    <p className="mt-1 text-xl font-bold">{Number(currentPeriod.rolloverHoursIn)}h</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Used</p>
                    <p className="mt-1 text-xl font-bold">{Number(currentPeriod.usedHours)}h</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Remaining</p>
                    <p className="mt-1 text-xl font-bold text-primary">
                      {(
                        Number(currentPeriod.includedHours) +
                        Number(currentPeriod.rolloverHoursIn) -
                        Number(currentPeriod.usedHours)
                      ).toFixed(1)}
                      h
                    </p>
                  </div>
                </div>
              </div>

              {Number(currentPeriod.overageHours) > 0 && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                  <p className="text-sm font-medium">Overage</p>
                  <p className="mt-1 text-xl font-bold text-destructive">
                    {Number(currentPeriod.overageHours)}h
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Estimated cost: ${(Number(currentPeriod.overageHours) * Number(retainer.ratePerHour)).toFixed(2)}
                  </p>
                </div>
              )}

              <div className="pt-4">
                <Link href={`/dashboard/time-entries?clientId=${retainer.clientId}`}>
                  <Button variant="outline" size="sm">
                    View Time Entries
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Travel Configuration */}
      {(() => {
        const r = retainer as any
        return (r.travelTimeBilling || r.travelExpensesEnabled) && (
          <Card>
            <CardHeader>
              <CardTitle>Travel Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {r.travelTimeBilling && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Travel Time Billing</p>
                  <p className="mt-1">
                    {r.travelTimeBilling === "INCLUDED_HOURS"
                      ? "Counts Against Retainer Hours"
                      : r.travelTimeBilling === "OVERAGE"
                      ? "Bill as Overage"
                      : "Non-Billable"}
                  </p>
                  {r.travelTimeRate && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Travel rate: ${Number(r.travelTimeRate).toFixed(2)}/hour
                    </p>
                  )}
                </div>
              )}

              {r.travelExpensesEnabled && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Travel Expenses</p>
                  <div className="mt-2 space-y-1">
                    {r.mileageRate && (
                      <p className="text-sm">
                        Mileage: ${Number(r.mileageRate).toFixed(3)}/mile
                      </p>
                    )}
                    {r.perDiemRate && (
                      <p className="text-sm">
                        Per Diem: ${Number(r.perDiemRate).toFixed(2)}/day
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })()}

      {/* Period History */}
      <Card>
        <CardHeader>
          <CardTitle>Period History</CardTitle>
        </CardHeader>
        <CardContent>
          {retainer.periods.length === 0 ? (
            <p className="text-sm text-muted-foreground">No periods yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Included</TableHead>
                  <TableHead>Rollover In</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Overage</TableHead>
                  <TableHead>Rollover Out</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {retainer.periods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell>
                      {new Date(period.periodStart).toLocaleDateString()} -{" "}
                      {new Date(period.periodEnd).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{Number(period.includedHours)}h</TableCell>
                    <TableCell>{Number(period.rolloverHoursIn)}h</TableCell>
                    <TableCell>{Number(period.usedHours)}h</TableCell>
                    <TableCell className={Number(period.overageHours) > 0 ? "text-destructive font-medium" : ""}>
                      {Number(period.overageHours)}h
                    </TableCell>
                    <TableCell>{Number(period.rolloverHoursOut)}h</TableCell>
                    <TableCell>
                      <Badge variant={period.status === "OPEN" ? "default" : "secondary"}>
                        {period.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
