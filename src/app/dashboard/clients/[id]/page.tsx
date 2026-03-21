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

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return null
  }

  const client = await prisma.client.findUnique({
    where: {
      id: params.id,
      tenantId: session.user.tenantId,
    },
    include: {
      retainers: {
        orderBy: { createdAt: "desc" },
      },
      timeEntries: {
        include: {
          user: { select: { name: true } },
          category: { select: { name: true } },
        },
        orderBy: { startTime: "desc" },
        take: 10,
      },
    },
  })

  if (!client) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {client.companyName}
          </h2>
          <p className="text-muted-foreground">
            Client details and activity
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/clients/${client.id}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
          <Link href="/dashboard/clients">
            <Button variant="outline">Back to Clients</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Client Information */}
        <Card>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <div className="mt-1">
                {client.isActive ? (
                  <Badge variant="default">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
            </div>

            {client.primaryContactName && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Primary Contact</p>
                <p className="mt-1">{client.primaryContactName}</p>
              </div>
            )}

            {client.email && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="mt-1">{client.email}</p>
              </div>
            )}

            {client.phone && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Phone</p>
                <p className="mt-1">{client.phone}</p>
              </div>
            )}

            {client.billingEmail && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Billing Email</p>
                <p className="mt-1">{client.billingEmail}</p>
              </div>
            )}

            {client.timezone && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Timezone</p>
                <p className="mt-1">{client.timezone}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Retainers */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Retainers ({client.retainers.length})</CardTitle>
              <Link href={`/dashboard/retainers/new?clientId=${client.id}`}>
                <Button size="sm" variant="outline">+ New</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {client.retainers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No retainers yet</p>
            ) : (
              <div className="space-y-3">
                {client.retainers.map((retainer) => (
                  <Link
                    key={retainer.id}
                    href={`/dashboard/retainers/${retainer.id}`}
                    className="block rounded-lg border p-3 hover:bg-accent"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{retainer.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {Number(retainer.includedHours)} hours/month
                        </p>
                      </div>
                      <Badge
                        variant={
                          retainer.status === "ACTIVE"
                            ? "default"
                            : retainer.status === "PAUSED"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {retainer.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Time Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {client.timeEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No time entries yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.timeEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {new Date(entry.startTime).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{entry.externalDescription}</TableCell>
                    <TableCell>{entry.user.name}</TableCell>
                    <TableCell>{entry.category?.name || "-"}</TableCell>
                    <TableCell className="text-right">
                      {entry.durationMinutes} min
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
