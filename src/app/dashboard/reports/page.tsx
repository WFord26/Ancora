import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ReportsPage() {
  const reports = [
    {
      title: "Utilization",
      description: "Track retainer usage rates by client and period. See who is under or over their included hours.",
      href: "/dashboard/reports/utilization",
      icon: "📊",
    },
    {
      title: "Profitability",
      description: "Revenue, hours worked, and effective rates per client. Identify your most profitable relationships.",
      href: "/dashboard/reports/profitability",
      icon: "💰",
    },
    {
      title: "Aging Invoices",
      description: "Outstanding invoices broken down by age bucket. Quickly spot overdue payments needing follow-up.",
      href: "/dashboard/reports/aging",
      icon: "📋",
    },
    {
      title: "Revenue Forecast",
      description: "Project future revenue based on active retainers and historical usage trends.",
      href: "/dashboard/reports/forecast",
      icon: "📈",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
        <p className="text-muted-foreground">
          Analytics and insights for your retainer business
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {reports.map((report) => (
          <Link key={report.href} href={report.href}>
            <Card className="h-full transition-colors hover:bg-accent/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <span className="text-2xl">{report.icon}</span>
                  {report.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {report.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
