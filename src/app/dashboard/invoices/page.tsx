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

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return null
  }

  const invoices = await prisma.invoice.findMany({
    where: { tenantId: session.user.tenantId },
    include: {
      client: { select: { companyName: true } },
      lineItems: true,
      payments: true,
    },
    orderBy: { invoiceDate: "desc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Invoices</h2>
          <p className="text-muted-foreground">
            View and manage client invoices
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Invoice Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No invoices yet. Invoices will be generated automatically during billing cycles.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => {
                const totalPaid = invoice.payments.reduce(
                  (sum, payment) => sum + Number(payment.amount),
                  0
                )
                const balance = Number(invoice.totalAmount) - totalPaid

                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/clients/${invoice.clientId}`}
                        className="hover:underline"
                      >
                        {invoice.client.companyName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {new Date(invoice.invoiceDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      ${Number(invoice.totalAmount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      ${totalPaid.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invoice.status === "PAID"
                            ? "default"
                            : invoice.status === "OVERDUE"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {invoice.status}
                      </Badge>
                      {balance > 0 && invoice.status !== "PAID" && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ${balance.toFixed(2)} due
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/invoices/${invoice.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
