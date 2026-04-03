import type { Metadata } from "next"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import AppSurface from "@/components/layout/app-surface"

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
    <AppSurface>
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/50 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-xl font-bold text-white">Ancora System Admin</h1>
            <p className="text-sm text-slate-400">System-wide administration</p>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-300">
              {session.user.email}
            </span>
            <span className="inline-flex items-center rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-medium text-sky-300">
              ADMIN
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:bg-white/5 hover:text-white"
              asChild
            >
              <Link href="/logout">Sign Out</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden w-56 border-r border-slate-800/80 bg-slate-950/35 backdrop-blur lg:block">
          <nav className="space-y-1 p-6">
            <Link
              href="/admin"
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/tenants"
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Tenants
            </Link>
            <Link
              href="/admin/users"
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Users
            </Link>
            <Link
              href="/admin/system-settings"
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
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
    </AppSurface>
  )
}
