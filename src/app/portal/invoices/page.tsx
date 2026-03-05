import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function PortalInvoicesPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return null
  }

  // Find the client linked to this user
  const client = await prisma.client.findFirst({
    where: {
      tenantId: session.user.tenantId,
      email: session.user.email,
    },
  })

  if (!client) {
    return (
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Invoices</h2>
        <p className="mt-2 text-muted-foreground">
          Account not linked to a client profile. Contact your account manager.
        </p>
      </div>
    )
  }

  const invoices = await prisma.invoice.findMany({
    where: { clientId: client.id },
    include: {
      payments: { select: { amount: true, status: true } },
    },
    orderBy: { issuedDate: "desc" },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Invoices</h2>
        <p className="text-muted-foreground">
          View and pay your invoices
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No invoices yet.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice: any) => {
                const totalPaid = invoice.payments
                  .filter((p: any) => p.status === "SUCCEEDED")
                  .reduce((sum: number, p: any) => sum + Number(p.amount), 0)
                const balance = Number(invoice.total) - totalPaid

                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/portal/invoices/${invoice.id}`}
                        className="hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {new Date(invoice.issuedDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      ${Number(invoice.total).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      ${totalPaid.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {balance > 0 ? (
                        <span className="text-destructive font-medium">
                          ${balance.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">$0.00</span>
                      )}
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
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/portal/invoices/${invoice.id}`}>
                        <span className="text-sm text-primary hover:underline cursor-pointer">
                          View
                        </span>
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
