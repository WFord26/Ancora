import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Clock,
  BarChart3,
  Users,
  FileText,
  Zap,
  Shield,
} from "lucide-react"

export default function LandingPage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />
        
        <div className="container mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Retainer Management{" "}
              <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                Made Simple
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Track time, manage retainer hours, handle rollovers, and generate invoices—all in one place. Built for IT consulting firms.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link href="/auth/landing/setup">Start Free Trial</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#features">Learn More</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything You Need
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Comprehensive tools for managing retainer-based IT consulting
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Clock,
                title: "Time Tracking",
                description: "Log time entries with categorization, notes, and timestamp precision.",
              },
              {
                icon: BarChart3,
                title: "Retainer Hours",
                description: "Track included hours, monitor usage, and manage rollover policies.",
              },
              {
                icon: FileText,
                title: "Invoice Generation",
                description: "Auto-generate invoices with retainer fees and overage charges.",
              },
              {
                icon: Users,
                title: "Client Portal",
                description: "Give clients read-only access to their invoices and hours.",
              },
              {
                icon: Zap,
                title: "Automated Billing",
                description: "Monthly billing cycles with automatic period rollover and calculations.",
              },
              {
                icon: Shield,
                title: "Enterprise Ready",
                description: "Multi-tenant architecture, SOC2 compliance, role-based access.",
              },
            ].map((feature, idx) => {
              const Icon = feature.icon
              return (
                <Card key={idx} className="border-border/50 hover:border-border/100 transition-colors">
                  <CardHeader>
                    <Icon className="h-8 w-8 mb-2 text-blue-500" />
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple Pricing
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Scalable pricing that grows with your business
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {[
              {
                name: "Starter",
                price: "$99",
                period: "per month",
                description: "For small consulting teams",
                features: [
                  "Up to 5 team members",
                  "Unlimited clients",
                  "Basic time tracking",
                  "Email support",
                  "Monthly invoicing",
                ],
              },
              {
                name: "Professional",
                price: "$299",
                period: "per month",
                description: "For growing agencies",
                features: [
                  "Up to 20 team members",
                  "Unlimited clients",
                  "Advanced time tracking",
                  "Priority support",
                  "Custom categories",
                  "Client portal",
                  "API access",
                ],
                highlighted: true,
              },
              {
                name: "Enterprise",
                price: "Custom",
                period: "contact us",
                description: "For large organizations",
                features: [
                  "Unlimited team members",
                  "Unlimited clients",
                  "Advanced integrations",
                  "Dedicated support",
                  "Custom workflows",
                  "SSO / SAML",
                  "SLA guarantee",
                ],
              },
            ].map((plan, idx) => (
              <Card
                key={idx}
                className={`flex flex-col ${
                  plan.highlighted ? "border-blue-500 ring-1 ring-blue-500/20 lg:scale-105" : "border-border/50"
                }`}
              >
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, fidx) => (
                      <li key={fidx} className="flex gap-2 text-sm">
                        <span className="text-blue-500 font-bold">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    asChild
                  >
                    <Link href="/auth/landing/setup">
                      {plan.name === "Enterprise" ? "Contact Sales" : "Get Started"}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to simplify your billing?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start your free trial today. No credit card required.
          </p>
          <div className="mt-8">
            <Button size="lg" asChild>
              <Link href="/auth/landing/setup">Start Your Free Trial</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
