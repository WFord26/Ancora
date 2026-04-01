import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"

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
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.svg" alt="Ancora" width={120} height={40} priority />
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/auth/landing/signin">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/landing/setup">Install Self-Hosted</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-border/50 bg-muted/20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr] lg:px-8">
          <div className="space-y-3">
            <Image src="/logo.svg" alt="Ancora" width={120} height={40} />
            <p className="max-w-md text-sm text-muted-foreground">
              Ancora gives consulting teams a single system for time, retainers,
              invoices, expenses, and client visibility, without falling back to
              spreadsheet glue.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Explore
            </h3>
            <div className="mt-4 space-y-2 text-sm">
              <Link href="#capabilities" className="block transition-colors hover:text-foreground">
                Capabilities
              </Link>
              <Link href="#workflow" className="block transition-colors hover:text-foreground">
                Workflow
              </Link>
              <Link href="#deployment" className="block transition-colors hover:text-foreground">
                Deployment
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Access
            </h3>
            <div className="mt-4 space-y-2 text-sm">
              <Link href="/auth/landing/signin" className="block transition-colors hover:text-foreground">
                Sign In
              </Link>
              <Link href="/auth/landing/setup" className="block transition-colors hover:text-foreground">
                First-Time Installer
              </Link>
              <Link href="/portal/login" className="block transition-colors hover:text-foreground">
                Client Portal
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 px-4 py-4 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
          © 2026 Ancora
        </div>
      </footer>
    </div>
  )
}
