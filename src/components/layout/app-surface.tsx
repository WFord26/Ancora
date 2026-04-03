import { cn } from "@/lib/utils"

export default function AppSurface({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-8 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute right-[-3rem] top-1/3 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute bottom-[-4rem] left-1/3 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20" />
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  )
}
