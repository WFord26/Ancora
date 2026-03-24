import type { Metadata } from "next"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Building2, Settings, LogOut } from "lucide-react"

export const metadata: Metadata = {
  title: "Ancora System Admin",
  description: "System administration dashboard",
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    redirect("/auth/signin")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-xl font-bold">Ancora System Admin</h1>
            <p className="text-sm text-muted-foreground">System-wide administration</p>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {session.user.email}
            </span>
            <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
              ADMIN
            </span>
            <Button variant="ghost" size="sm" asChild>
              <a href="/auth/signout">Sign Out</a>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden w-56 border-r lg:block">
          <nav className="space-y-1 p-6">
            <Link
              href="/admin"
              className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/tenants"
              className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted"
            >
              Tenants
            </Link>
            <Link
              href="/admin/users"
              className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted"
            >
              Users
            </Link>
            <Link
              href="/admin/system-settings"
              className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted"
            >
              System Settings
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
