import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function PortalPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return null
  }

  // Find the client record linked to this user's email
  const client = await prisma.client.findFirst({
    where: {
      tenantId: session.user.tenantId,
      email: session.user.email,
    },
  })

  if (!client) {
    return (
      <div className="space-y-4">
        <h2 className="text-3xl font-bold tracking-tight">Welcome</h2>
        <p className="text-muted-foreground">
          Your account is not linked to a client profile. Please contact your account manager.
        </p>
      </div>
    )
  }

  // Fetch overview data
  const [activeRetainers, recentInvoices, unpaidInvoices] = await Promise.all([
    prisma.retainer.findMany({
      where: { clientId: client.id, status: "ACTIVE" },
      include: {
        periods: {
          where: { status: "OPEN" },
          take: 1,
          orderBy: { periodStart: "desc" },
        },
      },
    }),
    prisma.invoice.findMany({
      where: { clientId: client.id },
      orderBy: { issuedDate: "desc" },
      take: 5,
    }),
    prisma.invoice.count({
      where: {
        clientId: client.id,
        status: { in: ["SENT", "OVERDUE"] },
      },
    }),
  ])

  const totalOutstanding = recentInvoices
    .filter((inv: any) => inv.status === "SENT" || inv.status === "OVERDUE")
    .reduce((sum: number, inv: any) => sum + Number(inv.total), 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Welcome, {client.primaryContactName || client.companyName}
        </h2>
        <p className="text-muted-foreground">{client.companyName}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Retainers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeRetainers.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unpaid Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{unpaidInvoices}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outstanding Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalOutstanding > 0 ? "text-destructive" : ""}`}>
              ${totalOutstanding.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Retainers */}
      {activeRetainers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Retainers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeRetainers.map((retainer: any) => {
              const period = retainer.periods[0]
              const includedHours = Number(retainer.includedHours)
              const usedHours = period ? Number(period.usedHours) : 0
              const utilization = includedHours > 0 ? (usedHours / includedHours) * 100 : 0

              return (
                <div key={retainer.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{retainer.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {includedHours} hours/month
                      </p>
                    </div>
                    <Badge variant={utilization > 90 ? "destructive" : "default"}>
                      {usedHours.toFixed(1)} / {includedHours} hrs
                    </Badge>
                  </div>

                  {period && (
                    <div className="mt-3">
                      <div className="flex justify-between text-sm text-muted-foreground mb-1">
                        <span>
                          {new Date(period.periodStart).toLocaleDateString()} –{" "}
                          {new Date(period.periodEnd).toLocaleDateString()}
                        </span>
                        <span>{Math.min(utilization, 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${
                            utilization > 100
                              ? "bg-destructive"
                              : utilization > 80
                              ? "bg-yellow-500"
                              : "bg-primary"
                          }`}
                          style={{ width: `${Math.min(utilization, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Recent Invoices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Invoices</CardTitle>
          <Link
            href="/portal/invoices"
            className="text-sm text-primary hover:underline"
          >
            View All
          </Link>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet</p>
          ) : (
            <div className="space-y-3">
              {recentInvoices.map((invoice: any) => (
                <Link
                  key={invoice.id}
                  href={`/portal/invoices/${invoice.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{invoice.invoiceNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(invoice.issuedDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">
                      ${Number(invoice.total).toFixed(2)}
                    </span>
                    <Badge
                      variant={
                        invoice.status === "PAID"
                          ? "default"
                          : invoice.status === "OVERDUE"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
