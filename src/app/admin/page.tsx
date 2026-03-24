import { User } from "lucide-react"
import { prisma } from "@/db"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions)

  // Get admin stats
  const [tenantCount, userCount, clientCount] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.client.count(),
  ])

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
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground mt-2">System overview and key metrics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common admin tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <a href="/admin/tenants" className="block p-3 border rounded-lg hover:bg-muted transition-colors">
            <p className="font-medium text-sm">Manage Tenants</p>
            <p className="text-xs text-muted-foreground">Create, view, and manage tenants</p>
          </a>
          <a href="/admin/users" className="block p-3 border rounded-lg hover:bg-muted transition-colors">
            <p className="font-medium text-sm">Manage Users</p>
            <p className="text-xs text-muted-foreground">View and manage system users</p>
          </a>
          <a href="/admin/system-settings" className="block p-3 border rounded-lg hover:bg-muted transition-colors">
            <p className="font-medium text-sm">System Settings</p>
            <p className="text-xs text-muted-foreground">Configure system-level settings</p>
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
