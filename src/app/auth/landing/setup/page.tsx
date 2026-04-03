import Link from "next/link"
import FirstRunInstaller from "@/components/auth/first-run-installer"
import { getBootstrapState } from "@/lib/bootstrap"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ShieldAlert, Wrench } from "lucide-react"
import AppSurface from "@/components/layout/app-surface"

export const dynamic = "force-dynamic"

export default async function SetupPage() {
  const bootstrapState = await getBootstrapState()

  if (bootstrapState.canRunInstaller) {
    return <FirstRunInstaller />
  }

  if (bootstrapState.isInstalled) {
    return (
      <AppSurface>
        <div className="flex min-h-screen items-center justify-center px-4 py-12">
          <div className="w-full max-w-lg space-y-6">
            <Card className="border-emerald-500/30 bg-slate-900/60 shadow-2xl shadow-slate-950/30 backdrop-blur">
            <CardHeader className="space-y-2">
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-center text-white">Ancora Is Already Installed</CardTitle>
              <CardDescription className="text-center text-slate-400">
                This production database already has a workspace and admin account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-slate-400">
                <p>
                  The public installer locks after the first successful bootstrap so the
                  instance cannot be re-claimed.
                </p>
                <p>
                  Sign in with an existing admin account to continue managing this workspace.
                </p>
              </div>
              <Button className="w-full" asChild>
                <Link href="/auth/signin">Go to Sign In</Link>
              </Button>
            </CardContent>
            </Card>
          </div>
        </div>
      </AppSurface>
    )
  }

  return (
    <AppSurface>
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg space-y-6">
          <Card className="border-amber-500/30 bg-slate-900/60 shadow-2xl shadow-slate-950/30 backdrop-blur">
          <CardHeader className="space-y-2">
            <div className="flex justify-center mb-4">
              <ShieldAlert className="h-12 w-12 text-amber-500" />
            </div>
            <CardTitle className="text-2xl text-center text-white">Installer Unavailable</CardTitle>
            <CardDescription className="text-slate-400">
              The first-time installer is intentionally limited to fresh production
              deployments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-400">
            <div className="flex gap-3 rounded-lg border border-slate-800/80 bg-slate-950/50 p-4">
              <Wrench className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-200" />
              <div className="space-y-2">
                <p>
                  For local development, use seeded data or create records manually after
                  connecting your database.
                </p>
                <p>
                  For production, deploy against an empty database and revisit this page to
                  bootstrap the first admin workspace.
                </p>
              </div>
            </div>

            <Button className="w-full" asChild>
              <Link href="/auth/signin">Go to Sign In</Link>
            </Button>
          </CardContent>
          </Card>
        </div>
      </div>
    </AppSurface>
  )
}
