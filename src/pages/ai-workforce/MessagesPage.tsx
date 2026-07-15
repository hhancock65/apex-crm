import { Mail, MessageSquare } from "lucide-react"
import { useState } from "react"

import { AiActionResultBadge } from "@/components/ai-workforce/AiActionResultBadge"
import { AiEmployeeAvatar } from "@/components/ai-workforce/AiEmployeeAvatar"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAiEmployees } from "@/hooks/useAiEmployees"
import { getDefaultMessageFilters, useMessages, type MessageChannel } from "@/hooks/useMessages"
import { cn, formatDateTime } from "@/lib/utils"
import { contactFullName } from "@/types/contact"

export default function MessagesPage() {
  const [filters, setFilters] = useState(getDefaultMessageFilters)

  const { data, isLoading, isFetching, error } = useMessages(filters)
  const { data: employees } = useAiEmployees()

  const messages = data?.messages ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize))

  function updateFilter<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Messages</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every SMS and email your AI Workforce has sent, and whether it went through.
        </p>
      </div>

      {/* Filter bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <Select
          value={filters.channel}
          onValueChange={(v) => updateFilter("channel", v as MessageChannel | "all")}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="email">Email</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.aiEmployeeId} onValueChange={(v) => updateFilter("aiEmployeeId", v)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="AI Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees?.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter("dateFrom", e.target.value)}
            className="w-[150px]"
            aria-label="From date"
          />
          <span className="text-sm text-slate-400">to</span>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter("dateTo", e.target.value)}
            className="w-[150px]"
            aria-label="To date"
          />
        </div>
      </div>

      {/* Log */}
      <div className={cn("mt-4 space-y-2", isFetching && "opacity-60")}>
        {isLoading ? (
          <p className="py-10 text-center text-sm text-slate-400">Loading messages…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-destructive">
            Failed to load messages: {error instanceof Error ? error.message : "Unknown error"}
          </p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No messages sent yet.</p>
        ) : (
          messages.map((message) => {
            const isEmail = message.action_type === "email_sent"
            const ChannelIcon = isEmail ? Mail : MessageSquare
            const recipientName = message.contact ? contactFullName(message.contact) : null
            const recipientDetail = isEmail ? message.contact?.email : message.contact?.phone

            return (
              <div
                key={message.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
              >
                {message.ai_employee ? (
                  <AiEmployeeAvatar role={message.ai_employee.role} />
                ) : (
                  <div className="h-7 w-7 shrink-0 rounded-full bg-slate-100" />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">
                      {message.ai_employee?.name ?? "Unknown employee"}
                    </span>
                    <ChannelIcon className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-sm text-slate-600">
                      {isEmail ? "Email" : "SMS"} to {recipientName ?? recipientDetail ?? "unknown recipient"}
                    </span>
                  </div>
                  {message.description && (
                    <p className="mt-0.5 truncate text-sm text-slate-500">{message.description}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <AiActionResultBadge result={message.result} />
                  <span className="w-[130px] shrink-0 text-right text-xs text-slate-400">
                    {formatDateTime(message.created_at)}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex justify-end">
          <Pagination
            page={filters.page}
            pageCount={pageCount}
            onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
          />
        </div>
      )}
    </div>
  )
}
