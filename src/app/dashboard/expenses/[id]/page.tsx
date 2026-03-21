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

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SUBMITTED: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
  REIMBURSED: "default",
}

export default async function ExpenseDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return null
  }

  const expense = await prisma.expense.findUnique({
    where: {
      id: params.id,
      tenantId: session.user.tenantId,
    },
    include: {
      client: { select: { id: true, companyName: true } },
      user: { select: { name: true, email: true } },
      category: { select: { name: true } },
      approver: { select: { name: true, email: true } },
      documents: {
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          uploadedAt: true,
        },
        orderBy: { id: "desc" },
      },
      invoice: { select: { id: true, invoiceNumber: true } },
    },
  })

  if (!expense) {
    notFound()
  }

  const canApprove =
    session.user.role === "ADMIN" ||
    (session.user.role === "STAFF" && expense.userId !== session.user.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Expense Detail
          </h2>
          <p className="text-muted-foreground">
            {expense.category.name} — {expense.client.companyName}
          </p>
        </div>
        <div className="flex gap-2">
          {expense.status === "DRAFT" && (
            <form action={`/api/expenses/${expense.id}/submit`} method="POST">
              <Button type="submit" variant="outline">Submit for Approval</Button>
            </form>
          )}
          {expense.status === "SUBMITTED" && canApprove && (
            <>
              <form action={`/api/expenses/${expense.id}/approve`} method="POST">
                <Button type="submit">Approve</Button>
              </form>
              <form action={`/api/expenses/${expense.id}/reject`} method="POST">
                <Button type="submit" variant="destructive">Reject</Button>
              </form>
            </>
          )}
          <Link href="/dashboard/expenses">
            <Button variant="outline">Back to Expenses</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Expense Details */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <div className="mt-1">
                <Badge variant={statusVariant[expense.status] || "secondary"}>
                  {expense.status}
                </Badge>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Date</p>
              <p className="mt-1">
                {new Date(expense.expenseDate).toLocaleDateString()}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Amount</p>
              <p className="mt-1 text-2xl font-bold">
                ${Number(expense.amount).toFixed(2)}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Billable</p>
              <p className="mt-1">
                <Badge variant={expense.isBillable ? "default" : "secondary"}>
                  {expense.isBillable ? "Yes" : "No"}
                </Badge>
              </p>
            </div>

            {expense.merchant && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Merchant</p>
                <p className="mt-1">{expense.merchant}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submission Info */}
        <Card>
          <CardHeader>
            <CardTitle>Submission</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Submitted By</p>
              <p className="mt-1">{expense.user.name || expense.user.email}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Client</p>
              <p className="mt-1">
                <Link
                  href={`/dashboard/clients/${expense.client.id}`}
                  className="hover:underline"
                >
                  {expense.client.companyName}
                </Link>
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Category</p>
              <p className="mt-1">{expense.category.name}</p>
            </div>

            {expense.invoice && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Invoice</p>
                <p className="mt-1">
                  <Link
                    href={`/dashboard/invoices/${expense.invoice.id}`}
                    className="hover:underline"
                  >
                    {expense.invoice.invoiceNumber}
                  </Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval Info */}
        <Card>
          <CardHeader>
            <CardTitle>Approval</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {expense.approver ? (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {expense.status === "APPROVED" || expense.status === "REIMBURSED"
                    ? "Approved By"
                    : expense.status === "REJECTED"
                    ? "Rejected By"
                    : "Reviewed By"}
                </p>
                <p className="mt-1">
                  {expense.approver.name || expense.approver.email}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not yet reviewed</p>
            )}

            {expense.approvedAt && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {expense.status === "REJECTED" ? "Rejected At" : "Approved At"}
                </p>
                <p className="mt-1">
                  {new Date(expense.approvedAt).toLocaleString()}
                </p>
              </div>
            )}

            {expense.rejectedReason && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Reason</p>
                <p className="mt-1 text-destructive">{expense.rejectedReason}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{expense.description}</p>
          {expense.internalNotes && (
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground">Internal Notes</p>
              <p className="mt-1 text-sm">{expense.internalNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Receipts & Documents ({expense.documents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {expense.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents attached</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expense.documents.map((doc: any) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.fileName}</TableCell>
                    <TableCell>{doc.mimeType}</TableCell>
                    <TableCell>
                      {doc.fileSize
                        ? `${(doc.fileSize / 1024).toFixed(1)} KB`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/api/expenses/${expense.id}/documents/${doc.id}`}
                        target="_blank"
                      >
                        <Button variant="ghost" size="sm">
                          Download
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
