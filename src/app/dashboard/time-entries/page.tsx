import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import TimesheetExportButton from "@/components/dashboard/timesheet-export-button"

export default async function TimeEntriesPage({
  searchParams,
}: {
  searchParams: { clientId?: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return null
  }

  const [timeEntries, retainers] = await Promise.all([
    prisma.timeEntry.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(searchParams.clientId && { clientId: searchParams.clientId }),
      },
      include: {
        client: { select: { companyName: true } },
        user: { select: { name: true } },
        category: { select: { name: true } },
        invoice: { select: { invoiceNumber: true, id: true } },
      },
      orderBy: { startTime: "desc" },
      take: 100,
    }),
    prisma.retainer.findMany({
      where: {
        tenantId: session.user.tenantId,
        status: "ACTIVE",
      },
      select: { id: true, name: true, clientId: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Time Entries</h2>
          <p className="text-muted-foreground">
            Track billable hours and activities
          </p>
        </div>
      <div className="flex items-center gap-3">
        <TimesheetExportButton retainers={retainers} />
        <Link href="/dashboard/time-entries/new">
          <Button>+ New Time Entry</Button>
        </Link>
      </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timeEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No time entries yet. Create your first time entry to get started.
                </TableCell>
              </TableRow>
            ) : (
              timeEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    {new Date(entry.startTime).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/clients/${entry.clientId}`}
                      className="hover:underline"
                    >
                      {entry.client.companyName}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {entry.externalDescription}
                  </TableCell>
                  <TableCell>{entry.user.name}</TableCell>
                  <TableCell>{entry.category?.name || "-"}</TableCell>
                  <TableCell>
                    {entry.invoice ? (
                      <Link
                        href={`/dashboard/invoices/${entry.invoice.id}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {entry.invoice.invoiceNumber}
                      </Link>
                    ) : entry.isTravelTime ? (
                      <Badge variant="secondary" className="text-xs">
                        Travel – Next Bill
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">–</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {Math.floor(entry.durationMinutes / 60)}h {entry.durationMinutes % 60}m
                    {entry.isTravelTime && (
                      <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">✈</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/dashboard/time-entries/${entry.id}/edit`}>
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
