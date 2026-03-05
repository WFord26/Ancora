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
import { PayButton } from "@/components/client-portal/pay-button"

export default async function PortalInvoiceDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { payment?: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return null
  }

  // Verify this client owns the invoice
  const client = await prisma.client.findFirst({
    where: {
      tenantId: session.user.tenantId,
      email: session.user.email,
    },
  })

  if (!client) {
    return notFound()
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id, clientId: client.id },
    include: {
      lineItems: true,
      payments: {
        where: { status: "SUCCEEDED" },
        orderBy: { paidAt: "desc" },
      },
      retainerPeriod: {
        include: {
          retainer: { select: { name: true } },
        },
      },
    },
  })

  if (!invoice) {
    return notFound()
  }

  const totalPaid = invoice.payments.reduce(
    (sum: number, p: any) => sum + Number(p.amount),
    0
  )
  const balance = Number(invoice.total) - totalPaid
  const showPayButton = invoice.status !== "PAID" && invoice.status !== "VOID" && balance > 0

  return (
    <div className="space-y-6">
      {/* Payment Success/Cancel Banner */}
      {searchParams.payment === "success" && (
        <div className="rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            Payment submitted successfully! It may take a moment for the status to update.
          </p>
        </div>
      )}
      {searchParams.payment === "cancelled" && (
        <div className="rounded-md bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-4">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Payment was cancelled. You can try again when ready.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Invoice {invoice.invoiceNumber}
          </h2>
          {invoice.retainerPeriod?.retainer && (
            <p className="text-muted-foreground">
              {invoice.retainerPeriod.retainer.name}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/api/invoices/${invoice.id}/pdf`} target="_blank">
            <Button variant="outline">View PDF</Button>
          </Link>
          <Link href="/portal/invoices">
            <Button variant="outline">Back to Invoices</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Invoice Info */}
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
              <p className="text-sm font-medium text-muted-foreground">
                Invoice Date
              </p>
              <p className="mt-1">
                {new Date(invoice.issuedDate).toLocaleDateString()}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Due Date
              </p>
              <p className="mt-1">
                {new Date(invoice.dueDate).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Amounts */}
        <Card>
          <CardHeader>
            <CardTitle>Amount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total</p>
              <p className="mt-1 text-2xl font-bold">
                ${Number(invoice.total).toFixed(2)}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Paid</p>
              <p className="mt-1 text-lg text-green-600 dark:text-green-400">
                ${totalPaid.toFixed(2)}
              </p>
            </div>

            {balance > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Balance Due
                </p>
                <p className="mt-1 text-lg font-bold text-destructive">
                  ${balance.toFixed(2)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Action */}
        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent>
            {showPayButton ? (
              <PayButton invoiceId={invoice.id} />
            ) : invoice.status === "PAID" ? (
              <div className="flex items-center justify-center rounded-lg bg-green-50 dark:bg-green-950 p-4">
                <p className="font-medium text-green-800 dark:text-green-200">
                  Paid in Full
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No payment required
              </p>
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
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lineItems.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">
                    {Number(item.quantity)}
                  </TableCell>
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
                <TableCell colSpan={3} className="text-right font-bold text-base">
                  Total
                </TableCell>
                <TableCell className="text-right font-bold text-base">
                  ${Number(invoice.total).toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payment History */}
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
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.payments.map((payment: any) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {payment.paidAt
                        ? new Date(payment.paidAt).toLocaleDateString()
                        : new Date(payment.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="capitalize">
                      {payment.paymentMethod || "Card"}
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
