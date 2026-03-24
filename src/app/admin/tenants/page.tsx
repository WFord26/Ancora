import { prisma } from "@/db"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default async function AdminTenantsPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    redirect("/auth/signin")
  }

  // Fetch all tenants with their stats
  const tenants = await prisma.tenant.findMany({
    include: {
      _count: {
        select: {
          users: true,
          clients: true,
          retainers: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">System Tenants</h2>
        <p className="text-muted-foreground mt-2">
          Manage all tenants in the system
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tenants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenants.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Onboarding Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tenants.filter((t) => t.onboardingCompleted).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(
                (tenants.filter((t) => t.onboardingCompleted).length /
                  tenants.length) *
                  100
              )}
              % complete
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tenants.reduce((sum, t) => sum + t._count.users, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tenants</CardTitle>
          <CardDescription>
            Manage and monitor all tenants across the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tenants found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant Name</TableHead>
                    <TableHead>Timezone</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Clients</TableHead>
                    <TableHead>Retainers</TableHead>
                    <TableHead>Onboarding</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <div className="font-medium">{tenant.name}</div>
                        <p className="text-xs text-muted-foreground font-mono">
                          {tenant.id}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {tenant.timezone || "UTC"}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {tenant._count.users}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {tenant._count.clients}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {tenant._count.retainers}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            tenant.onboardingCompleted
                              ? "bg-green-500/10 text-green-700 dark:text-green-400"
                              : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                          }
                        >
                          {tenant.onboardingCompleted
                            ? "Complete"
                            : "In Progress"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(tenant.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
