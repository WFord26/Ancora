import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import AppSurface from "@/components/layout/app-surface"

const navItems = [
  { href: "#capabilities", label: "Capabilities" },
  { href: "#workflow", label: "Workflow" },
  { href: "#deployment", label: "Deployment" },
]

export default function MarketingShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppSurface>
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/55 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.svg" alt="Ancora" width={120} height={40} priority />
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="text-slate-300 hover:bg-white/5 hover:text-white"
              asChild
            >
              <Link href="/auth/landing/signin">Sign In</Link>
            </Button>
            <Button className="shadow-lg shadow-sky-950/30" asChild>
              <Link href="/auth/landing/setup">Install Self-Hosted</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-slate-800/80 bg-slate-950/35 backdrop-blur">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr] lg:px-8">
          <div className="space-y-3">
            <Image src="/logo.svg" alt="Ancora" width={120} height={40} />
            <p className="max-w-md text-sm text-slate-400">
              Ancora gives consulting teams a single system for time, retainers,
              invoices, expenses, and client visibility, without falling back to
              spreadsheet glue.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              Explore
            </h3>
            <div className="mt-4 space-y-2 text-sm">
              <Link href="#capabilities" className="block text-slate-300 transition-colors hover:text-white">
                Capabilities
              </Link>
              <Link href="#workflow" className="block text-slate-300 transition-colors hover:text-white">
                Workflow
              </Link>
              <Link href="#deployment" className="block text-slate-300 transition-colors hover:text-white">
                Deployment
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              Access
            </h3>
            <div className="mt-4 space-y-2 text-sm">
              <Link href="/auth/landing/signin" className="block text-slate-300 transition-colors hover:text-white">
                Sign In
              </Link>
              <Link href="/auth/landing/setup" className="block text-slate-300 transition-colors hover:text-white">
                First-Time Installer
              </Link>
              <Link href="/portal/login" className="block text-slate-300 transition-colors hover:text-white">
                Client Portal
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800/80 px-4 py-4 text-center text-sm text-slate-500 sm:px-6 lg:px-8">
          © 2026 Ancora
        </div>
      </footer>
    </AppSurface>
  )
}
