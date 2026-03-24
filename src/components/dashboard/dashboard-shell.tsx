"use client"

import * as Dialog from "@radix-ui/react-dialog"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DashboardShellProps = {
  children: React.ReactNode
  userEmail: string
  userRole: string
}

type NavItem = {
  href: string
  label: string
}

const coreNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/clients", label: "Clients" },
  { href: "/dashboard/retainers", label: "Retainers" },
  { href: "/dashboard/time-entries", label: "Time Entries" },
  { href: "/dashboard/invoices", label: "Invoices" },
  { href: "/dashboard/expenses", label: "Expenses" },
  { href: "/dashboard/reports", label: "Reports" },
]

const adminNavItems: NavItem[] = [
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/users", label: "Users" },
  { href: "/dashboard/integrations", label: "Integrations" },
]

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function DashboardNavSection({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[]
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <>
      {items.map((item) => {
        const isActive = isActivePath(pathname, item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </>
  )
}

export default function DashboardShell({
  children,
  userEmail,
  userRole,
}: DashboardShellProps) {
  const pathname = usePathname()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  const isAdmin = userRole === "ADMIN"

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="flex h-16 items-center gap-3 px-4 md:px-6">
          <Dialog.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <Dialog.Trigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open dashboard navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </Dialog.Trigger>

            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden" />
              <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-full max-w-xs flex-col border-r bg-background shadow-xl outline-none md:hidden">
                <div className="flex h-16 items-center justify-between border-b px-4">
                  <Dialog.Title className="sr-only">
                    Dashboard navigation
                  </Dialog.Title>
                  <Image
                    src="/logo.svg"
                    alt="Ancora"
                    width={120}
                    height={40}
                    priority
                  />
                  <Dialog.Close asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Close dashboard navigation"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </Dialog.Close>
                </div>

                <div className="border-b px-4 py-4">
                  <p className="truncate text-sm font-medium">{userEmail}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {userRole}
                  </p>
                </div>

                <nav className="space-y-1 p-4">
                  <DashboardNavSection
                    items={coreNavItems}
                    pathname={pathname}
                    onNavigate={() => setMobileNavOpen(false)}
                  />

                  {isAdmin && (
                    <>
                      <div className="my-3 border-t" />
                      <DashboardNavSection
                        items={adminNavItems}
                        pathname={pathname}
                        onNavigate={() => setMobileNavOpen(false)}
                      />
                    </>
                  )}
                </nav>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <Link href="/dashboard" className="shrink-0">
            <Image
              src="/logo.svg"
              alt="Ancora"
              width={120}
              height={40}
              priority
            />
          </Link>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-4">
            <span className="hidden truncate text-sm text-muted-foreground sm:inline">
              {userEmail}
            </span>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {userRole}
            </span>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden w-64 border-r md:block">
          <nav className="space-y-1 p-4">
            <DashboardNavSection items={coreNavItems} pathname={pathname} />

            {isAdmin && (
              <>
                <div className="my-2 border-t" />
                <DashboardNavSection items={adminNavItems} pathname={pathname} />
              </>
            )}
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
