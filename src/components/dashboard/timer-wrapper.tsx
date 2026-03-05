import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import FloatingTimer from "./floating-timer"

export default async function TimerWrapper() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role === "CLIENT") {
    return null
  }

  const tenantId = session.user.tenantId

  const [clients, retainers, categories] = await Promise.all([
    prisma.client.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
    prisma.retainer.findMany({
      where: { tenantId, status: "ACTIVE" },
      select: { id: true, name: true, clientId: true },
      orderBy: { name: "asc" },
    }),
    prisma.timeCategory.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ])

  return (
    <FloatingTimer
      clients={clients}
      retainers={retainers}
      categories={categories}
      userTimezone={session.user.timezone || "UTC"}
    />
  )
}
