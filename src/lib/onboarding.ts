import { prisma } from "@/db"

export type OnboardingStatus = {
  completed: boolean
  completedAt: Date | null
  currentStep: number
  nextRoute: string
  timezone: string
  stats: {
    clientsCount: number
    retainersCount: number
    teamMembersCount: number
  }
}

export async function getOnboardingStatus(
  tenantId: string
): Promise<OnboardingStatus | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      onboardingCompleted: true,
      onboardingCompletedAt: true,
      timezone: true,
      _count: {
        select: {
          clients: true,
          retainers: true,
          users: true,
        },
      },
    },
  })

  if (!tenant) {
    return null
  }

  const hasCompanySetup = Boolean(tenant.timezone?.trim())
  const hasClient = tenant._count.clients > 0
  const hasRetainer = tenant._count.retainers > 0
  const hasInvitedTeam = tenant._count.users > 1

  let currentStep = 1
  let nextRoute = "/dashboard/onboarding/company"

  if (tenant.onboardingCompleted) {
    currentStep = 5
    nextRoute = "/dashboard"
  } else if (!hasCompanySetup) {
    currentStep = 1
    nextRoute = "/dashboard/onboarding/company"
  } else if (!hasClient) {
    currentStep = 2
    nextRoute = "/dashboard/onboarding/client"
  } else if (!hasRetainer) {
    currentStep = 3
    nextRoute = "/dashboard/onboarding/retainer"
  } else if (!hasInvitedTeam) {
    currentStep = 4
    nextRoute = "/dashboard/onboarding/team"
  } else {
    currentStep = 5
    nextRoute = "/dashboard/onboarding/complete"
  }

  return {
    completed: tenant.onboardingCompleted,
    completedAt: tenant.onboardingCompletedAt,
    currentStep,
    nextRoute,
    timezone: tenant.timezone,
    stats: {
      clientsCount: tenant._count.clients,
      retainersCount: tenant._count.retainers,
      teamMembersCount: tenant._count.users,
    },
  }
}
