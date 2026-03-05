import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default async function ClientsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return null
  }

  const clients = await prisma.client.findMany({
    where: { tenantId: session.user.tenantId },
    include: {
      _count: {
        select: {
          retainers: true,
          timeEntries: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Clients</h2>
          <p className="text-muted-foreground">
            Manage your client accounts
          </p>
        </div>
        <Link href="/dashboard/clients/new">
          <Button>+ New Client</Button>
        </Link>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Retainers</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No clients found. Create your first client to get started.
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">
                    <Link 
                      href={`/dashboard/clients/${client.id}`}
                      className="hover:underline"
                    >
                      {client.companyName}
                    </Link>
                  </TableCell>
                  <TableCell>{client.primaryContactName || "-"}</TableCell>
                  <TableCell>{client.email || "-"}</TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {client._count.retainers} retainer{client._count.retainers !== 1 ? "s" : ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    {client.isActive ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/dashboard/clients/${client.id}/edit`}>
                      <Button variant="ghost" size="sm">Edit</Button>
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
