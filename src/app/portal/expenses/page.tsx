import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ExpenseStatus, InvoiceStatus } from "@prisma/client"

type ExpenseWithRelations = {
  id: string
  amount: number | string
  expenseDate: Date
  description: string
  merchant: string | null
  invoiceId: string | null
  category: { name: string; color: string }
  retainer: { name: string } | null
  invoice: { invoiceNumber: string; status: InvoiceStatus } | null
  status: ExpenseStatus
}

function formatCurrency(amount: number | string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount))
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "APPROVED":
      return "default"
    case "SUBMITTED":
      return "secondary"
    case "REJECTED":
      return "destructive"
    default:
      return "outline"
  }
}

export default async function PortalExpensesPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return null
  }

  // Find the client record linked to this user's email
  const client = await prisma.client.findFirst({
    where: {
      tenantId: session.user.tenantId,
      email: session.user.email,
    },
  })

  if (!client) {
    return (
      <div className="space-y-4">
        <h2 className="text-3xl font-bold tracking-tight">Expenses</h2>
        <p className="text-muted-foreground">
          Your account is not linked to a client profile. Please contact your
          account manager.
        </p>
      </div>
    )
  }

  // Fetch billable expenses for this client (only approved or invoiced ones visible to client)
  const expensesRaw = await prisma.expense.findMany({
    where: {
      clientId: client.id,
      tenantId: session.user.tenantId,
      isBillable: true,
      status: { in: ["APPROVED", "REIMBURSED"] },
    },
    include: {
      category: { select: { name: true, color: true } },
      retainer: { select: { name: true } },
      invoice: { select: { invoiceNumber: true, status: true } },
    },
    orderBy: { expenseDate: "desc" },
  })
  const expenses: ExpenseWithRelations[] = expensesRaw as unknown as ExpenseWithRelations[]

  // Summary stats
  const totalBilled = expenses.reduce(
    (sum: number, e: ExpenseWithRelations) => sum + Number(e.amount),
    0
  )
  const invoicedExpenses = expenses.filter(
    (e: ExpenseWithRelations) => e.invoiceId != null
  )
  const totalInvoiced = invoicedExpenses.reduce(
    (sum: number, e: ExpenseWithRelations) => sum + Number(e.amount),
    0
  )
  const uninvoicedExpenses = expenses.filter(
    (e: ExpenseWithRelations) => e.invoiceId == null
  )
  const totalUninvoiced = uninvoicedExpenses.reduce(
    (sum: number, e: ExpenseWithRelations) => sum + Number(e.amount),
    0
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Expenses</h2>
        <p className="text-muted-foreground">
          Billable expenses charged to your account
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalBilled)}</p>
            <p className="text-xs text-muted-foreground">
              {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Invoiced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(totalInvoiced)}
            </p>
            <p className="text-xs text-muted-foreground">
              {invoicedExpenses.length} included in invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Invoice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(totalUninvoiced)}
            </p>
            <p className="text-xs text-muted-foreground">
              {uninvoicedExpenses.length} awaiting invoicing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Expenses Table */}
      {expenses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No billable expenses found for your account.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Expense History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 pr-4 font-medium">Description</th>
                    <th className="pb-3 pr-4 font-medium">Category</th>
                    <th className="pb-3 pr-4 font-medium">Retainer</th>
                    <th className="pb-3 pr-4 font-medium text-right">Amount</th>
                    <th className="pb-3 pr-4 font-medium">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense: ExpenseWithRelations) => (
                    <tr key={expense.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {formatDate(expense.expenseDate)}
                      </td>
                      <td className="py-3 pr-4">
                        <div>
                          <p className="font-medium">{expense.description}</p>
                          {expense.merchant && (
                            <p className="text-xs text-muted-foreground">
                              {expense.merchant}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: expense.category.color,
                            }}
                          />
                          {expense.category.name}
                        </div>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                        {expense.retainer?.name || "—"}
                      </td>
                      <td className="py-3 pr-4 text-right whitespace-nowrap font-medium">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {expense.invoice ? (
                          <Badge variant={statusBadgeVariant(expense.invoice.status)}>
                            {expense.invoice.invoiceNumber}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
