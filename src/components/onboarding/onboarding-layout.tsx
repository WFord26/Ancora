"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ChevronLeft } from "lucide-react"

interface OnboardingLayoutProps {
  children: React.ReactNode
  currentStep?: number
  totalSteps?: number
  showBackButton?: boolean
}

export default function OnboardingLayout({
  children,
  currentStep = 1,
  totalSteps = 5,
  showBackButton = false,
}: OnboardingLayoutProps) {
  const router = useRouter()

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6 md:py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Welcome to Ancora</h1>
          <p className="mt-1 text-slate-400">
            Let&apos;s set up your retainer management system
          </p>
        </div>
        {showBackButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="gap-2 border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm text-slate-400">
          <span>
            Step {currentStep} of {totalSteps}
          </span>
          <span className="font-medium">
            {Math.round((currentStep / totalSteps) * 100)}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      <Card className="border-slate-800/80 bg-slate-900/50 shadow-2xl shadow-slate-950/30 backdrop-blur">
        {children}
      </Card>

      <div className="flex justify-center gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-2 w-8 rounded-full transition-all duration-300 ${
              i < currentStep
                ? "bg-gradient-to-r from-blue-500 to-purple-500"
                : i === currentStep - 1
                  ? "bg-blue-500/70"
                  : "bg-slate-700"
            }`}
          />
        ))}
      </div>
    </div>
  )
}
