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
  showBackButton = false 
}: OnboardingLayoutProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Welcome to Ancora</h1>
            <p className="text-slate-400 mt-1">
              Let's set up your retainer management system
            </p>
          </div>
          {showBackButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-slate-400">
            <span>Step {currentStep} of {totalSteps}</span>
            <span className="font-medium">{Math.round((currentStep / totalSteps) * 100)}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          {children}
        </Card>

        {/* Step indicators */}
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
    </div>
  )
}
