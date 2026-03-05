import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SUBMITTED: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
  REIMBURSED: "default",
}

export default async function ExpensesPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return null
  }

  const [expenses, summary] = await Promise.all([
    prisma.expense.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        client: { select: { companyName: true } },
        user: { select: { name: true, email: true } },
        category: { select: { name: true } },
      },
      orderBy: { expenseDate: "desc" },
      take: 100,
    }),
    prisma.expense.groupBy({
      by: ["status"],
      where: { tenantId: session.user.tenantId },
      _count: true,
      _sum: { amount: true },
    }),
  ])

  const summaryMap = Object.fromEntries(
    summary.map((s: any) => [s.status, { count: s._count, total: Number(s._sum.amount || 0) }])
  )

  const pendingApproval = (summaryMap.SUBMITTED?.count || 0)
  const totalDraft = (summaryMap.DRAFT?.count || 0)
  const totalApproved = (summaryMap.APPROVED?.total || 0) + (summaryMap.REIMBURSED?.total || 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Expenses</h2>
          <p className="text-muted-foreground">
            Track and manage billable and internal expenses
          </p>
        </div>
        <Link href="/dashboard/expenses/new">
          <Button>New Expense</Button>
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingApproval}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Drafts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalDraft}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${totalApproved.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{expenses.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Expenses Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Submitted By</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Billable</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No expenses yet. Click &quot;New Expense&quot; to add one.
                </TableCell>
              </TableRow>
            ) : (
              expenses.map((expense: any) => (
                <TableRow key={expense.id}>
                  <TableCell>
                    {new Date(expense.expenseDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{expense.user.name || expense.user.email}</TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/clients/${expense.clientId}`}
                      className="hover:underline"
                    >
                      {expense.client.companyName}
                    </Link>
                  </TableCell>
                  <TableCell>{expense.category.name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {expense.description}
                  </TableCell>
                  <TableCell className="text-right">
                    ${Number(expense.amount).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={expense.isBillable ? "default" : "secondary"}>
                      {expense.isBillable ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[expense.status] || "secondary"}>
                      {expense.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/dashboard/expenses/${expense.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
