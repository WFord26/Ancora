import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import AppSurface from "@/components/layout/app-surface"

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/portal/login")
  }

  // Only CLIENT role can access the portal
  if (session.user.role !== "CLIENT") {
    redirect("/dashboard")
  }

  return (
    <AppSurface>
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/50 backdrop-blur-xl">
        <div className="flex h-16 items-center px-4 md:px-6">
          <div className="flex items-center space-x-4">
            <Image
              src="/logo.svg"
              alt="Ancora"
              width={120}
              height={40}
              priority
            />
            <span className="text-sm text-slate-400">Client Portal</span>
          </div>

          <div className="ml-auto flex items-center space-x-4">
            <span className="text-sm text-slate-300">
              {session.user.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:bg-white/5 hover:text-white"
              asChild
            >
              <Link href="/logout">Log Out</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden w-56 border-r border-slate-800/80 bg-slate-950/35 backdrop-blur md:block">
          <nav className="space-y-1 p-4">
            <a
              href="/portal"
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Overview
            </a>
            <a
              href="/portal/invoices"
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Invoices
            </a>
            <a
              href="/portal/retainers"
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Retainers
            </a>
            <a
              href="/portal/expenses"
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Expenses
            </a>
            <a
              href="/portal/time-entries"
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Time Log
            </a>
          </nav>
        </aside>

        {/* Page Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </AppSurface>
  )
}
