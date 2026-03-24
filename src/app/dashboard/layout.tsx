import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { authOptions } from "@/lib/auth"
import DashboardShell from "@/components/dashboard/dashboard-shell"
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
    <DashboardShell
      userEmail={session.user.email ?? ""}
      userRole={session.user.role}
    >
      {children}
      {/* Floating Timer */}
      <Suspense fallback={null}>
        <TimerWrapper />
      </Suspense>
    </DashboardShell>
  )
}
