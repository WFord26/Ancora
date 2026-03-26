import { prisma } from "@/db"

export interface BootstrapState {
  isProduction: boolean
  tenantCount: number
  userCount: number
  isInstalled: boolean
  canRunInstaller: boolean
}

export async function getBootstrapState(): Promise<BootstrapState> {
  const [tenantCount, userCount] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
  ])

  const isProduction = process.env.NODE_ENV === "production"
  const isInstalled = tenantCount > 0 || userCount > 0

  return {
    isProduction,
    tenantCount,
    userCount,
    isInstalled,
    canRunInstaller: isProduction && !isInstalled,
  }
}

export function slugifyTenantName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return slug || "workspace"
}
