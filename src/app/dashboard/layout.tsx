import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { authOptions } from "@/lib/auth"
import TimerWrapper from "@/components/dashboard/timer-wrapper"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/signin")
  }

  // CLIENT role should use portal, not dashboard
  if (session.user.role === "CLIENT") {
    redirect("/portal")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="flex h-16 items-center px-4 md:px-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">Ancora</h1>
          </div>
          
          <div className="ml-auto flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              {session.user.email}
            </span>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {session.user.role}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden w-64 border-r md:block">
          <nav className="space-y-1 p-4">
            <a
              href="/dashboard"
              className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Dashboard
            </a>
            <a
              href="/dashboard/clients"
              className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Clients
            </a>
            <a
              href="/dashboard/retainers"
              className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Retainers
            </a>
            <a
              href="/dashboard/time-entries"
              className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Time Entries
            </a>
            <a
              href="/dashboard/invoices"
              className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Invoices
            </a>
            <a
              href="/dashboard/expenses"
              className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Expenses
            </a>
            <a
              href="/dashboard/reports"
              className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Reports
            </a>
            {session.user.role === "ADMIN" && (
              <>
                <div className="my-2 border-t" />
                <a
                  href="/dashboard/settings"
                  className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  Settings
                </a>
                <a
                  href="/dashboard/users"
                  className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  Users
                </a>
              </>
            )}
          </nav>
        </aside>

        {/* Page Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>

      {/* Floating Timer */}
      <Suspense fallback={null}>
        <TimerWrapper />
      </Suspense>
    </div>
  )
}
