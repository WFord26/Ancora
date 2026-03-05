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

export default async function RetainersPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return null
  }

  const retainers = await prisma.retainer.findMany({
    where: { tenantId: session.user.tenantId },
    include: {
      client: { select: { companyName: true } },
      periods: {
        where: { status: "OPEN" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Retainers</h2>
          <p className="text-muted-foreground">
            Manage client retainer agreements
          </p>
        </div>
        <Link href="/dashboard/retainers/new">
          <Button>+ New Retainer</Button>
        </Link>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Retainer Name</TableHead>
              <TableHead>Hours/Month</TableHead>
              <TableHead>Monthly Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {retainers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No retainers yet. Create your first retainer to get started.
                </TableCell>
              </TableRow>
            ) : (
              retainers.map((retainer) => (
                <TableRow key={retainer.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/clients/${retainer.clientId}`}
                      className="hover:underline"
                    >
                      {retainer.client.companyName}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/retainers/${retainer.id}`}
                      className="hover:underline"
                    >
                      {retainer.name}
                    </Link>
                  </TableCell>
                  <TableCell>{Number(retainer.includedHours)}</TableCell>
                  <TableCell>${(Number(retainer.ratePerHour) * Number(retainer.includedHours)).toFixed(2)}</TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/dashboard/retainers/${retainer.id}`}>
                      <Button variant="ghost" size="sm">
                        View
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
