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
import { Badge } from "@/components/ui/badge"

export default async function SystemSettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    redirect("/auth/signin")
  }

  // Fetch system statistics
  const [tenantCount, userCount, clientCount, retainerCount, invoiceCount] =
    await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.client.count(),
      prisma.retainer.count(),
      prisma.invoice.count(),
    ])

  // Get admin user info
  const adminUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      timezone: true,
    },
  })

  const stats = [
    {
      label: "Total Tenants",
      value: tenantCount,
      icon: "🏢",
    },
    {
      label: "Total Users",
      value: userCount,
      icon: "👥",
    },
    {
      label: "Total Clients",
      value: clientCount,
      icon: "💼",
    },
    {
      label: "Total Retainers",
      value: retainerCount,
      icon: "📋",
    },
    {
      label: "Total Invoices",
      value: invoiceCount,
      icon: "🧾",
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">System Settings</h2>
        <p className="text-muted-foreground mt-2">
          System administration and configuration
        </p>
      </div>

      {/* Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.icon}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Info */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Admin Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Your Account</CardTitle>
            <CardDescription>System administrator profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Email
              </label>
              <p className="mt-1 font-mono text-sm">{adminUser?.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Name
              </label>
              <p className="mt-1">{adminUser?.name || "Not set"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Timezone
              </label>
              <p className="mt-1">{adminUser?.timezone || "UTC"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Admin Since
              </label>
              <p className="mt-1">
                {adminUser?.createdAt
                  ? new Date(adminUser.createdAt).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* System Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>System Configuration</CardTitle>
            <CardDescription>Current system status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Environment
              </label>
              <div className="mt-1">
                <Badge>
                  {process.env.NODE_ENV?.toUpperCase() || "DEVELOPMENT"}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Multi-Tenant
              </label>
              <div className="mt-1">
                <Badge className="bg-green-500/10 text-green-700 dark:text-green-400">
                  Enabled
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Authentication
              </label>
              <div className="mt-1">
                <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
                  NextAuth.js (JWT)
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Database
              </label>
              <div className="mt-1">
                <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-400">
                  PostgreSQL + Prisma
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>System administration actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <a
            href="/admin/users"
            className="block p-3 border rounded-lg hover:bg-muted transition-colors"
          >
            <p className="font-medium text-sm">Manage Users</p>
            <p className="text-xs text-muted-foreground">
              View and manage all system users
            </p>
          </a>
          <a
            href="/admin/tenants"
            className="block p-3 border rounded-lg hover:bg-muted transition-colors"
          >
            <p className="font-medium text-sm">Manage Tenants</p>
            <p className="text-xs text-muted-foreground">
              View and manage all system tenants
            </p>
          </a>
          <a
            href="/admin"
            className="block p-3 border rounded-lg hover:bg-muted transition-colors"
          >
            <p className="font-medium text-sm">Admin Dashboard</p>
            <p className="text-xs text-muted-foreground">
              Return to admin dashboard
            </p>
          </a>
        </CardContent>
      </Card>

      {/* System Notes */}
      <Card>
        <CardHeader>
          <CardTitle>System Notes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            • This is the system administration panel for managing Ancora
            infrastructure
          </p>
          <p>
            • Multi-tenant architecture ensures data isolation between
            organizations
          </p>
          <p>
            • All administrative actions are logged for audit purposes
          </p>
          <p>
            • Contact support for advanced system administration tasks
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
