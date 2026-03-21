import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return null
  }

  const invoice = await prisma.invoice.findUnique({
    where: {
      id: params.id,
      tenantId: session.user.tenantId,
    },
    include: {
      client: {
        select: {
          id: true,
          companyName: true,
          primaryContactName: true,
          email: true,
          billingEmail: true,
        },
      },
      lineItems: {
        orderBy: { id: "asc" },
      },
      payments: {
        orderBy: { paidAt: "desc" },
      },
    },
  })

  if (!invoice) {
    notFound()
  }

  const totalPaid = invoice.payments.reduce(
    (sum: number, payment: any) => sum + Number(payment.amount),
    0
  )
  const balance = Number(invoice.total) - totalPaid

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Invoice {invoice.invoiceNumber}
          </h2>
          <p className="text-muted-foreground">
            {invoice.client.companyName}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/clients/${invoice.clientId}`}>
            <Button variant="outline">View Client</Button>
          </Link>
          <Link href="/dashboard/invoices">
            <Button variant="outline">Back to Invoices</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Invoice Details */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <div className="mt-1">
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
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Invoice Date</p>
              <p className="mt-1">
                {new Date(invoice.issuedDate).toLocaleDateString()}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Due Date</p>
              <p className="mt-1">
                {new Date(invoice.dueDate).toLocaleDateString()}
              </p>
            </div>

            {invoice.stripeInvoiceId && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Stripe Invoice</p>
                <p className="mt-1 text-xs font-mono">{invoice.stripeInvoiceId}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client Information */}
        <Card>
          <CardHeader>
            <CardTitle>Bill To</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{invoice.client.companyName}</p>
            {invoice.client.primaryContactName && (
              <p className="text-sm">{invoice.client.primaryContactName}</p>
            )}
            {invoice.client.billingEmail && (
              <p className="text-sm">{invoice.client.billingEmail}</p>
            )}
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
              <p className="mt-1 text-2xl font-bold">
                ${Number(invoice.total).toFixed(2)}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Amount Paid</p>
              <p className="mt-1 text-lg text-green-600 dark:text-green-400">
                ${totalPaid.toFixed(2)}
              </p>
            </div>

            {balance > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Balance Due</p>
                <p className="mt-1 text-lg font-bold text-destructive">
                  ${balance.toFixed(2)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lineItems.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{Number(item.quantity)}</TableCell>
                  <TableCell className="text-right">
                    ${Number(item.unitPrice).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    ${Number(item.total).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">
                  Subtotal
                </TableCell>
                <TableCell className="text-right">
                  ${Number(invoice.subtotal).toFixed(2)}
                </TableCell>
              </TableRow>
              {Number(invoice.tax) > 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-medium">
                    Tax
                  </TableCell>
                  <TableCell className="text-right">
                    ${Number(invoice.tax).toFixed(2)}
                  </TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell colSpan={3} className="text-right font-bold">
                  Total
                </TableCell>
                <TableCell className="text-right font-bold">
                  ${Number(invoice.total).toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payments */}
      {invoice.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.payments.map((payment: any) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : new Date(payment.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="capitalize">{payment.paymentMethod || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {payment.stripePaymentIntentId || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      ${Number(payment.amount).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
