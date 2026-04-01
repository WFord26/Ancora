import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  Clock3,
  FileText,
  FolderSync,
  ReceiptText,
  ShieldCheck,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const capabilityCards = [
  {
    icon: Clock3,
    title: "Operational time tracking",
    description:
      "Capture work with client context, descriptions, and billable rules that map cleanly into the right retainer period.",
  },
  {
    icon: BarChart3,
    title: "Retainer visibility",
    description:
      "See included hours, rollover balances, overages, and timing before a billing surprise reaches the client.",
  },
  {
    icon: FileText,
    title: "Invoice drafting",
    description:
      "Generate invoices from retained work, export polished PDFs, and keep draft review in the same system your team already uses.",
  },
  {
    icon: ReceiptText,
    title: "Expenses that stay attached",
    description:
      "Track billable expenses alongside time so nothing gets lost between delivery, approval, and invoicing.",
  },
  {
    icon: Users,
    title: "Client-facing access",
    description:
      "Give clients a portal for invoices, retainers, and approved activity without handing over internal workflows.",
  },
  {
    icon: ShieldCheck,
    title: "Self-hosted control",
    description:
      "Run the app on infrastructure you already trust, with installer-led setup and a clear path to production hosting.",
  },
]

const workflowSteps = [
  {
    step: "01",
    title: "Define the agreement",
    description:
      "Set the retainer cadence, choose prepay or postpay, establish billing day rules, and configure rollover behavior.",
  },
  {
    step: "02",
    title: "Capture the real work",
    description:
      "Log time, assign expenses, and keep usage inside the correct period so reporting and invoices stay aligned.",
  },
  {
    step: "03",
    title: "Bill with context",
    description:
      "Generate draft invoices with retainer fees, overages, and expenses already tied back to the period they belong to.",
  },
]

export default function LandingContent() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_36%),radial-gradient(circle_at_80%_15%,rgba(245,158,11,0.12),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.05),transparent)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-28">
          <div className="space-y-8">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="border border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300">
                Self-hosted
              </Badge>
              <Badge variant="secondary" className="border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                Prepay or postpay retainers
              </Badge>
              <Badge variant="secondary" className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                Client portal included
              </Badge>
            </div>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">
                Retainer operations without spreadsheet drift.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                Ancora is built for consulting teams that need one calm system for
                time tracking, retainer periods, invoicing, expenses, and client
                visibility. Start self-hosted, stay in control, and bill with less
                cleanup at month end.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="gap-2" asChild>
                <Link href="/auth/landing/setup">
                  Install Self-Hosted
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/auth/landing/signin">Sign In</Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Billing modes
                </p>
                <p className="mt-2 text-lg font-semibold">Prepay or postpay</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Match how each client actually buys support.
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Deliverables
                </p>
                <p className="mt-2 text-lg font-semibold">Draft invoices + PDFs</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Export client-ready invoice drafts from the app.
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Visibility
                </p>
                <p className="mt-2 text-lg font-semibold">Usage by period</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Track retained hours before they become disputes.
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-6 top-10 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl" />
            <div className="absolute -right-6 bottom-6 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl" />

            <div className="relative overflow-hidden rounded-[28px] border border-border/60 bg-card/85 p-6 shadow-2xl shadow-sky-950/10 backdrop-blur">
              <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <div>
                  <p className="text-sm font-semibold">Ancora Command Surface</p>
                  <p className="text-sm text-muted-foreground">
                    A tighter loop between delivery, billing, and client review.
                  </p>
                </div>
                <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Live draft flow
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Retainer timing</p>
                      <p className="mt-1 text-xl font-semibold">Prepaid monthly support</p>
                    </div>
                    <div className="rounded-xl bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-700 dark:text-sky-300">
                      Day 1 invoice
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-muted/60 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Current period
                      </p>
                      <p className="mt-1 font-medium">Apr 1 to May 1</p>
                    </div>
                    <div className="rounded-xl bg-muted/60 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Draft invoice
                      </p>
                      <p className="mt-1 font-medium">$6,000 retainer fee</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <p className="text-sm font-medium text-muted-foreground">Usage snapshot</p>
                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="flex justify-between text-sm">
                          <span>Included hours</span>
                          <span>40h</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-muted">
                          <div className="h-2 w-[68%] rounded-full bg-sky-500" />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm">
                          <span>Used so far</span>
                          <span>27.2h</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-muted">
                          <div className="h-2 w-[52%] rounded-full bg-amber-500" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <p className="text-sm font-medium text-muted-foreground">What ships with the invoice</p>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
                        <FolderSync className="mt-0.5 h-4 w-4 text-sky-500" />
                        <div>
                          <p className="font-medium">Retainer fee linked to the correct period</p>
                          <p className="text-muted-foreground">No manual relabeling once the draft is created.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
                        <ReceiptText className="mt-0.5 h-4 w-4 text-amber-500" />
                        <div>
                          <p className="font-medium">Expenses stay attached</p>
                          <p className="text-muted-foreground">Approved costs follow the same billing trail as time.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="border-y border-border/50 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">
              Capabilities
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Built for the messy middle between delivery and billing.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Ancora is strongest where consulting teams usually start improvising:
              period boundaries, retained hours, client-ready invoices, and enough
              operational context to explain every number on the draft.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {capabilityCards.map((card) => {
              const Icon = card.icon
              return (
                <Card key={card.title} className="border-border/60 bg-card/80 shadow-sm">
                  <CardHeader>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="pt-3 text-xl">{card.title}</CardTitle>
                    <CardDescription className="text-sm leading-6">
                      {card.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-300">
              Workflow
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Keep the entire retainer cycle inside one motion.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              The goal is not more data entry. It is less translation between
              time captured, hours consumed, what the client sees, and what your
              team has to defend later.
            </p>
          </div>

          <div className="grid gap-4">
            {workflowSteps.map((step) => (
              <div
                key={step.step}
                className="rounded-[24px] border border-border/60 bg-card/80 p-6 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      Step {step.step}
                    </p>
                    <h3 className="text-xl font-semibold">{step.title}</h3>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="deployment" className="border-t border-border/50 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-[28px] border border-border/60 bg-card/85 p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
                Self-hosted fit
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Start where your team already operates.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Install Ancora on infrastructure you control, bootstrap the first
                workspace, and move from setup to billing operations without a
                long implementation project.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild>
                  <Link href="/auth/landing/setup">Run the Installer</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/auth/landing/signin">Access an Existing Workspace</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-[28px] border border-border/60 bg-card/85 p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Designed for consulting operations
              </p>
              <div className="mt-5 grid gap-4">
                <div className="rounded-2xl bg-muted/60 p-4">
                  <p className="font-medium">Retainers with nuance</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Monthly or biweekly cadence, prepay or postpay timing, rollover,
                    overages, and client-by-client billing behavior.
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/60 p-4">
                  <p className="font-medium">Fewer disconnected tools</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Replace the patchwork where time lives in one place, invoices in
                    another, and the real billing story lives in someone’s memory.
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/60 p-4">
                  <p className="font-medium">Cleaner client conversations</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Send draft PDFs with the period context already attached, then
                    let clients review invoices and retained work in the portal.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
