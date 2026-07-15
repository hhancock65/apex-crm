import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrencyPrecise, formatDate } from "@/lib/utils"
import type { InvoiceSummary } from "@/types/billing"

const STATUS_CLASSES: Record<string, string> = {
  paid: "border-green-200 bg-green-50 text-green-700",
  open: "border-amber-200 bg-amber-50 text-amber-700",
  void: "border-slate-200 bg-slate-50 text-slate-600",
  uncollectible: "border-red-200 bg-red-50 text-red-700",
  draft: "border-slate-200 bg-slate-50 text-slate-600",
}

interface InvoiceHistoryTableProps {
  invoices: InvoiceSummary[] | undefined
  isLoading: boolean
}

export function InvoiceHistoryTable({ invoices, isLoading }: InvoiceHistoryTableProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">Invoice History</h2>

      <div className="mt-3">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !invoices || invoices.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No invoices yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{formatDate(invoice.date)}</TableCell>
                  <TableCell>{formatCurrencyPrecise(invoice.amount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_CLASSES[invoice.status] ?? STATUS_CLASSES.draft}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {invoice.pdfUrl ? (
                      <a
                        href={invoice.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-apex-teal hover:underline"
                      >
                        Download
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
