import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return null
  }

  // Fetch dashboard stats
  const [clientCount, retainerCount, activeRetainerCount, recentTimeEntries] = await Promise.all([
    prisma.client.count({
      where: { tenantId: session.user.tenantId, isActive: true },
    }),
    prisma.retainer.count({
      where: { tenantId: session.user.tenantId },
    }),
    prisma.retainer.count({
      where: { 
        tenantId: session.user.tenantId,
        status: "ACTIVE"
      },
    }),
    prisma.timeEntry.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        client: { select: { companyName: true } },
        user: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: { startTime: "desc" },
      take: 5,
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome back, {session.user.name}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between space-x-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Clients</p>
              <p className="text-3xl font-bold">{clientCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between space-x-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Retainers</p>
              <p className="text-3xl font-bold">{activeRetainerCount}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {retainerCount} total
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between space-x-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Recent Entries</p>
              <p className="text-3xl font-bold">{recentTimeEntries.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Time Entries */}
      <div className="rounded-lg border bg-card">
        <div className="p-6">
          <h3 className="text-lg font-semibold">Recent Time Entries</h3>
        </div>
        <div className="border-t">
          {recentTimeEntries.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No time entries yet
            </div>
          ) : (
            <div className="divide-y">
              {recentTimeEntries.map((entry) => (
                <div key={entry.id} className="p-4 hover:bg-accent/50">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{entry.client.companyName}</p>
                      <p className="text-sm text-muted-foreground">
                        {entry.externalDescription}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{entry.user.name}</span>
                        {entry.category && (
                          <>
                            <span>•</span>
                            <span>{entry.category.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{entry.durationMinutes} min</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(entry.startTime).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Quick Actions</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <a
            href="/dashboard/time-entries/new"
            className="rounded-md border border-dashed border-primary bg-primary/5 p-4 text-center text-sm font-medium hover:bg-primary/10"
          >
            + Add Time Entry
          </a>
          <a
            href="/dashboard/clients/new"
            className="rounded-md border border-dashed border-primary bg-primary/5 p-4 text-center text-sm font-medium hover:bg-primary/10"
          >
            + New Client
          </a>
          <a
            href="/dashboard/retainers/new"
            className="rounded-md border border-dashed border-primary bg-primary/5 p-4 text-center text-sm font-medium hover:bg-primary/10"
          >
            + New Retainer
          </a>
          <a
            href="/dashboard/reports"
            className="rounded-md border border-dashed border-primary bg-primary/5 p-4 text-center text-sm font-medium hover:bg-primary/10"
          >
            View Reports
          </a>
        </div>
      </div>
    </div>
  )
}
