import { DealStatusBadge } from "@/components/deals/DealStatusBadge"
import { useContactDeals } from "@/hooks/useContacts"
import { formatCurrency, formatDate } from "@/lib/utils"

export function ContactDealsTab({ contactId }: { contactId: string }) {
  const { data: deals, isLoading } = useContactDeals(contactId)

  if (isLoading) {
    return <p className="py-6 text-center text-sm text-slate-400">Loading deals…</p>
  }

  if (!deals || deals.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">No deals yet.</p>
  }

  return (
    <ul className="divide-y divide-slate-100">
      {deals.map((deal) => (
        <li key={deal.id} className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">{deal.title}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {deal.stage?.name ?? "—"}
              {deal.expected_close_date && ` · Closes ${formatDate(deal.expected_close_date)}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-sm font-medium text-slate-700">
              {formatCurrency(deal.value)}
            </span>
            <DealStatusBadge status={deal.status} />
          </div>
        </li>
      ))}
    </ul>
  )
}
