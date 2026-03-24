import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { formatForDisplay } from "@/lib/timezone"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default async function PortalTimeEntriesPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return null
  }

  // Find the client linked to this portal user's email
  const client = await prisma.client.findFirst({
    where: {
      tenantId: session.user.tenantId,
      email: session.user.email,
    },
    select: {
      id: true,
      companyName: true,
      timezone: true,
    },
  })

  if (!client) {
    return (
      <div className="space-y-4">
        <h2 className="text-3xl font-bold tracking-tight">Time Log</h2>
        <p className="text-muted-foreground">
          Account not linked to a client profile. Contact your account manager.
        </p>
      </div>
    )
  }

  // Viewer timezone: client account timezone → session user timezone → UTC
  const displayTimezone =
    client.timezone ?? session.user.timezone ?? "UTC"

  // Fetch all approved/submitted time entries for this client
  const entries = await prisma.timeEntry.findMany({
    where: {
      clientId: client.id,
      tenantId: session.user.tenantId,
      isBillable: true,
    },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      durationMinutes: true,
      externalDescription: true,
      isTravelTime: true,
      status: true,
      retainer: {
        select: { id: true, name: true },
      },
      retainerPeriod: {
        select: { periodStart: true, periodEnd: true },
      },
      category: {
        select: { name: true },
      },
    },
    orderBy: { startTime: "desc" },
  })

  // Group entries by retainer period for readability
  type GroupKey = string
  type EntryRow = (typeof entries)[number]

  const groups = new Map<GroupKey, { label: string; entries: EntryRow[] }>()

  for (const entry of entries) {
    let key: GroupKey
    let label: string

    if (entry.retainerPeriod) {
      const start = new Date(entry.retainerPeriod.periodStart)
      key = start.toISOString().substring(0, 7) // "YYYY-MM"
      label = start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: displayTimezone })
    } else {
      key = "unassigned"
      label = "Unassigned Period"
    }

    if (!groups.has(key)) {
      groups.set(key, { label, entries: [] })
    }
    groups.get(key)!.entries.push(entry)
  }

  const sortedGroups = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))

  const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0)
  const totalHours = (totalMinutes / 60).toFixed(1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Time Log</h2>
          <p className="text-muted-foreground">
            Billable hours logged against your account — {totalHours} hours total
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No time entries have been logged yet.
        </div>
      ) : (
        <div className="space-y-8">
          {sortedGroups.map(([key, group]) => {
            const groupMinutes = group.entries.reduce((s, e) => s + e.durationMinutes, 0)
            const groupHours = (groupMinutes / 60).toFixed(1)

            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{group.label}</h3>
                  <span className="text-sm text-muted-foreground">{groupHours} hrs</span>
                </div>

                <div className="rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Retainer</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.entries.map((entry) => {
                        const durationHours = Math.floor(entry.durationMinutes / 60)
                        const durationMins = entry.durationMinutes % 60
                        const durationLabel =
                          durationHours > 0
                            ? `${durationHours}h ${durationMins > 0 ? `${durationMins}m` : ""}`.trim()
                            : `${durationMins}m`

                        const dateLabel = formatForDisplay(
                          entry.startTime,
                          displayTimezone,
                          "MMM d, yyyy"
                        )

                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="whitespace-nowrap text-sm">
                              {dateLabel}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {entry.externalDescription || (
                                  <span className="italic text-muted-foreground">No description</span>
                                )}
                              </span>
                              {entry.isTravelTime && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  Travel
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {entry.retainer?.name ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {entry.category?.name ?? (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {durationLabel}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
